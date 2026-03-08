---
layout: post
title: "Fixing Postgres table bloat with pg_repack"
date: 2026-03-07
permalink: /blah/:title/
categories: experiments
unlisted: true
---

## Crash Course: Postgres data storage topology
Every row in a table in Postgres is stored as a tuple. Tuples are stored in an 8 KB container referred to as a page. A page is a range of space within an actual file on disk, located within the file via an offset. These files exist within a directory for the specific database that they make up, and are up to 1 GB in size. 

Example:

```bash
$PGDATA/
└── base
    ├── 16384/                      # database OID (example)
    │   ├── 24576                   # table heap (main fork, relfilenode)
    │   ├── 24576.1                 # next 1GB segment (if large)
    │   ├── 24590                   # index relfilenode (e.g. pkey)
    └── 16385/                      # another database OID (example)
```
In the above tree, the directory `16384/` represents a database. The files represent relations (tables, indexes, etc.) and each contain pages. In those pages are tuples. A page looks something like:

```bash
+-------------------------------------------------------+
| header | line pointers | free space |    tuple data   |
+-------------------------------------------------------+

tuple data area:
| [tuple A] | [tuple B] | [tuple C] | [tuple D] |
```
and each tuple would be something like:

```bash
+--------------------------------------------------+
| tuple header | column values | optional metadata |
+--------------------------------------------------+
```

This is all oversimplified but hopefully gives you a high level understanding of what we're discussing.

### MVCC
Postgres' implementation of MVCC (Multi-Version Concurrency Control) creates a new tuple for each new or updated row. Additionally when a row is deleted, the associated tuple is not immediately removed from the page. Instead it is marked as dead and is cleaned up periodically by the *vacuuming* process (either manual or autovacuum). 

For example, if you create a new table and insert 100 rows there will be 100 tuples. If you then update 10 rows and delete 10 others, you now have 110 tuples. 90 of these will be "live" tuples, and 20 will be "dead". Normally in a healthy system autovacuum would regularly clean up these dead tuples. There are a variety of situations in which this might not be happening though, including just turning autovacuum off (not recommended). In this case the dead tuples are never cleaned up and they continue to grow, taking up more and more space on disk. 

Over time this accumulation of dead tuples will begin to negatively impact query performance. When Postgres loads a page into memory in order to perform some operation, it will need to filter through all the dead tuples, ignoring them as it goes. This leads to an increase in CPU cycles and in processing time. Additionally, the growing number of tuples will increase I/O pressure as Postgres will also need to just read more pages in order to find the live tuples among the dead. This is colloquially known as *table bloat*. 

Luckily, re-enabling or tuning autovacuum, or running a manual vacuum, will quickly and efficiently address the increased number of dead tuples. What a vacuum *won't* take care of, though, is reclaiming the disk space consumed by the increased number of pages. Even if entire pages are left without tuples after a vacuum, they will remain on disk, taking up space. Further, even once the dead tuples are gone the live tuples will be so sparsely distributed among the many pages that it can greatly slow down the processing of certain queries. 

So what, then, do you do about this?

There are really two options. First, you can run a `VACUUM FULL`. This does all of the same things as a normal `VACUUM` operation, but it will also reclaim the unused disk space from any empty or sparsely populated pages by rewriting the files on disk with only the live tuples from the existing pages. Think of it like defragging a HDD. The downside of `VACUUM FULL` is that it requires an `ACCESS EXCLUSIVE` lock on the table for the duration of the operation. That means no other process can update, delete, or even read from the table. This is clearly not a good option for production environments.

An alternative to `VACUUM FULL` is to use the application `pg_repack`. `pg_repack` achieves the same end as `VACUUM FULL`, but does so in an online manner, thus allowing other operations to execute against the table. This is what we'll explore below.

# Experiment
To demonstrate everything discussed above, I wrote some code that spins up a Postgres database with autovacuum disabled, generates bloat via inserting, updating, and deleting data, and then runs some queries against the database in its bloated state, in its vacuumed state, and in its state post-pg_repack. 

The repository with the source code to reproduce all of this for yourself can be found here: [https://github.com/jbonatakis/bloat-lab-pg-repack](https://github.com/jbonatakis/bloat-lab-pg-repack)

## Setup
Starting with a completely fresh system, let's create some bloat. First, insert 3M rows, update half of them 6 times, then delete 97% of them.

```bash
INITIAL_ROWS=3000000 \
PAYLOAD_BYTES=1000 \
UPDATE_ROUNDS=6 \
UPDATE_MODULUS=2 \
DELETE_PERCENT=97 \
./scripts/run_bloat.sh
```

Let's check the output:
```bash
>> ./scripts/report_bloat.sh

  relname   | n_live_tup | n_dead_tup | vacuum_count | autovacuum_count
------------+------------+------------+--------------+------------------
 bloat_test |      90514 |   11909467 |            0 |                0
(1 row)

 heap_size | indexes_size | total_size
-----------+--------------+------------
 13 GB     | 129 MB       | 13 GB
(1 row)

 table_len | live_tuple_len | dead_tuple_len | dead_tuple_pct | free_space | free_space_pct
-----------+----------------+----------------+----------------+------------+----------------
 13 GB     | 92 MB          | 1472 MB        |          10.99 | 11 GB      |          87.64
(1 row)
```
We can see that we have ~90k live tuples and ~11.9m dead tuples. We can also see that there have been no vacuum and no autovacuum runs. 

On the next line we can see that the heap size (that is, the amount of disk space consumed by files making up this table) is 13 GB. The index size is 129 MB, and the total size is 13 GB (these values are rounded to the nearest whole unit).

On the last line we can again see the size of the table on disk, then the size of the live tuples and the dead tuples, as well as the percent of the total table size that is consumed by dead tuples. Lastly we see the free space as a raw value and as a percent. That is space within pages that is currently unoccupied by live tuples and can be reused by PostgreSQL for future row versions, but still remains allocated to the table file on disk.

Now let's run some queries and get a baseline.

> [!NOTE]
> When looking at the Buffers output in the query plans below, a "hit" means Postgres found the data already cached in its shared memory (which is very fast), while a "read" means it had to fetch the data from the OS cache or the physical disk (which is much slower). Either way the combined number represents the total number of pages that Postgres processed in order to execute that query.

```bash
> explain (analyze, buffers) select count(*) from lab.bloat_test;

|------------------------------------------------------------------------------------------------------------------------------------------------|
| Aggregate  (cost=360159.14..360159.15 rows=1 width=8) (actual time=26384.272..26384.275 rows=1 loops=1)                                        |
|   Buffers: shared read=873541                                                                                                                  |
|   ->  Bitmap Heap Scan on bloat_test  (cost=66287.62..359932.86 rows=90514 width=0) (actual time=410.270..26374.290 rows=90000 loops=1)        |
|         Heap Blocks: exact=34584 lossy=822562                                                                                                  |
|         Buffers: shared read=873541                                                                                                            |
|         ->  Bitmap Index Scan on bloat_test_pkey  (cost=0.00..66264.99 rows=90514 width=0) (actual time=402.673..402.673 rows=4499998 loops=1) |
|               Buffers: shared read=16395                                                                                                       |
| Planning:                                                                                                                                      |
|   Buffers: shared hit=40 read=21                                                                                                               |
| Planning Time: 6.843 ms                                                                                                                        |
| JIT:                                                                                                                                           |
|   Functions: 3                                                                                                                                 |
|   Options: Inlining false, Optimization false, Expressions true, Deforming true                                                                |
|   Timing: Generation 0.231 ms, Inlining 0.000 ms, Optimization 0.434 ms, Emission 3.464 ms, Total 4.130 ms                                     |
| Execution Time: 26435.947 ms                                                                                                                   |
+------------------------------------------------------------------------------------------------------------------------------------------------+
```
The query took ~26s to proess ~90k rows. The bitmap index scan had to process ~4.5M index matches and the heap scan touched a huge number of blocks, indicating severe bloat.

```bash
> explain (analyze, buffers) select count(marker) from lab.bloat_test;

|---------------------------------------------------------------------------------------------------------------------------|
| Aggregate  (cost=1715414.42..1715414.43 rows=1 width=8) (actual time=8786.274..8786.307 rows=1 loops=1)                   |
|   Buffers: shared hit=16301 read=1697982                                                                                  |
|   ->  Seq Scan on bloat_test  (cost=0.00..1715188.14 rows=90514 width=4) (actual time=1.780..8635.773 rows=90000 loops=1) |
|         Buffers: shared hit=16301 read=1697982                                                                            |
| Planning:                                                                                                                 |
|   Buffers: shared hit=1 read=5 dirtied=1                                                                                  |
| Planning Time: 1.603 ms                                                                                                   |
| JIT:                                                                                                                      |
|   Functions: 3                                                                                                            |
|   Options: Inlining true, Optimization true, Expressions true, Deforming true                                             |
|   Timing: Generation 1.399 ms, Inlining 109.898 ms, Optimization 15.288 ms, Emission 18.355 ms, Total 144.940 ms          |
| Execution Time: 8789.161 ms                                                                                               |
+---------------------------------------------------------------------------------------------------------------------------+
```
I attempted to encourage a sequential scan by counting a non-indexed column, and the planner chose one. The Seq Scan processed ~90k visible rows. It hit 16,301 blocks already in shared buffers and read 1,697,982 additional blocks into shared buffers (from OS cache and/or disk), finishing in just under 9 seconds.

```bash
> explain (analyze, buffers) select * from lab.bloat_test where id = 50;

|------------------------------------------------------------------------------------------------------------------------|
| Bitmap Heap Scan on bloat_test  (cost=4.43..8.44 rows=1 width=1048) (actual time=1.384..1.385 rows=0 loops=1)          |
|   Recheck Cond: (id = 50)                                                                                              |
|   Heap Blocks: exact=2                                                                                                 |
|   Buffers: shared hit=3 read=5                                                                                         |
|   ->  Bitmap Index Scan on bloat_test_pkey  (cost=0.00..4.43 rows=1 width=0) (actual time=1.018..1.018 rows=2 loops=1) |
|         Index Cond: (id = 50)                                                                                          |
|         Buffers: shared hit=3 read=3                                                                                   |
| Planning:                                                                                                              |
|   Buffers: shared hit=6 read=6                                                                                         |
| Planning Time: 2.088 ms                                                                                                |
| Execution Time: 1.455 ms                                                                                               |
+------------------------------------------------------------------------------------------------------------------------+
```
This point lookup by id used a Bitmap Index Scan + Bitmap Heap Scan rather than a plain Index Scan. The index produced two candidate tuple pointers, but heap recheck found zero visible rows (rows=0), consistent with dead-version churn. The query touched 8 shared blocks (hit+read) and still took ~1.5 ms.

At this point let's vacuum, re-run, and see what changes.

## Vacuum
```sql
VACUUM ANALYZE lab.bloat_test;
```

```bash
>> ./scripts/report_bloat.sh

  relname   | n_live_tup | n_dead_tup | vacuum_count | autovacuum_count
------------+------------+------------+--------------+------------------
 bloat_test |      89486 |          0 |            1 |                0
(1 row)

 heap_size | indexes_size | total_size
-----------+--------------+------------
 13 GB     | 129 MB       | 13 GB
(1 row)

 table_len | live_tuple_len | dead_tuple_len | dead_tuple_pct | free_space | free_space_pct
-----------+----------------+----------------+----------------+------------+----------------
 13 GB     | 92 MB          | 0 bytes        |           0.00 | 13 GB      |          98.92
(1 row)
```
A much better looking picture here. No dead tuples after 1 vacuum. The heap size and total size of the table remains at 13 GB, which is consistent with the limitations of a plain vacuum. Notably, we can see that the free space has increased to almost 100% of the table space.

```bash
> explain (analyze, buffers) select count(*) from lab.bloat_test;

|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Aggregate  (cost=67378.42..67378.43 rows=1 width=8) (actual time=137.634..137.635 rows=1 loops=1)                                                   |
|   Buffers: shared hit=60014 read=16395 written=54                                                                                                   |
|   ->  Index Only Scan using bloat_test_pkey on bloat_test  (cost=0.42..67154.71 rows=89486 width=0) (actual time=0.113..134.279 rows=90000 loops=1) |
|         Heap Fetches: 0                                                                                                                             |
|         Buffers: shared hit=60014 read=16395 written=54                                                                                             |
| Planning:                                                                                                                                           |
|   Buffers: shared hit=13 read=1                                                                                                                     |
| Planning Time: 0.957 ms                                                                                                                             |
| Execution Time: 137.696 ms                                                                                                                          |
+-----------------------------------------------------------------------------------------------------------------------------------------------------+
```
This time our count(*) got an Index Only Scan. It still needed 60,014 blocks from shared buffers, and paged in 16,395, all to process 90k rows. This tracks with the lingering sparsity of our live tuples after a plain vacuum. 

```bash
> explain (analyze, buffers) select count(marker) from lab.bloat_test;

|---------------------------------------------------------------------------------------------------------------------------|
| Aggregate  (cost=1715401.58..1715401.59 rows=1 width=8) (actual time=8213.261..8213.266 rows=1 loops=1)                   |
|   Buffers: shared read=1714283                                                                                            |
|   ->  Seq Scan on bloat_test  (cost=0.00..1715177.86 rows=89486 width=4) (actual time=1.936..8154.255 rows=90000 loops=1) |
|         Buffers: shared read=1714283                                                                                      |
| Planning:                                                                                                                 |
|   Buffers: shared hit=3                                                                                                   |
| Planning Time: 0.362 ms                                                                                                   |
| JIT:                                                                                                                      |
|   Functions: 3                                                                                                            |
|   Options: Inlining true, Optimization true, Expressions true, Deforming true                                             |
|   Timing: Generation 2.431 ms, Inlining 7.074 ms, Optimization 24.294 ms, Emission 20.844 ms, Total 54.643 ms             |
| Execution Time: 8216.197 ms                                                                                               |
+---------------------------------------------------------------------------------------------------------------------------+
```
This query once again got a Sequential Scan, and once again finished in the 8 second range. It once again read a large number of pages (1,714,283) into shared buffers. Vacuum seemed to have little impact on its performance as the sequential scan still had to scan through the massively bloated heap to process this query. 

```bash
> explain (analyze,buffers) select * from lab.bloat_test where id = 50;

|------------------------------------------------------------------------------------------------------------------------|
| Bitmap Heap Scan on bloat_test  (cost=4.43..8.44 rows=1 width=1048) (actual time=1.682..1.683 rows=0 loops=1)          |
|   Recheck Cond: (id = 50)                                                                                              |
|   Buffers: shared read=3                                                                                               |
|   ->  Bitmap Index Scan on bloat_test_pkey  (cost=0.00..4.43 rows=1 width=0) (actual time=1.676..1.677 rows=0 loops=1) |
|         Index Cond: (id = 50)                                                                                          |
|         Buffers: shared read=3                                                                                         |
| Planning:                                                                                                              |
|   Buffers: shared hit=6                                                                                                |
| Planning Time: 0.670 ms                                                                                                |
| Execution Time: 1.790 ms                                                                                               |
+------------------------------------------------------------------------------------------------------------------------+
```
Finally, our point lookup. Once again a Bitmap Index Scan. It's still around the same execution time, completing in under 1.79 ms. I think we can get this faster.

## Repack
Now let's run pg_repack, getting rewriting the table data to free up space and reduce the number of pages, then check our results again.

```bash
>> time ./scripts/pg_repack.sh --dbname=repack_lab --table=lab.bloat_test
INFO: repacking table "lab.bloat_test"
./scripts/pg_repack.sh --dbname=repack_lab --table=lab.bloat_test  0.04s user 0.06s system 1% cpu 9.493 total
```

```bash
>> ./scripts/report_bloat.sh

  relname   | n_live_tup | n_dead_tup | vacuum_count | autovacuum_count
------------+------------+------------+--------------+------------------
 bloat_test |      90000 |          0 |            1 |                0
(1 row)

 heap_size | indexes_size | total_size
-----------+--------------+------------
 100 MB    | 1984 kB      | 102 MB
(1 row)

 table_len | live_tuple_len | dead_tuple_len | dead_tuple_pct | free_space | free_space_pct
-----------+----------------+----------------+----------------+------------+----------------
 100 MB    | 92 MB          | 0 bytes        |           0.00 | 7942 kB    |           7.72
(1 row)
```
Now we see again:
* 90k live tuples and no dead tuples
* A much smaller table size -- just 102 MB total instead of 13 GB
* Drastically reduced free space, from almost 100% down to under 8%

Let's look at the queries.

```bash
> explain (analyze, buffers) select count(*) from lab.bloat_test;

|-----------------------------------------------------------------------------------------------------------------------|
| Aggregate  (cost=13983.00..13983.01 rows=1 width=8) (actual time=39.206..39.207 rows=1 loops=1)                       |
|   Buffers: shared hit=12858                                                                                           |
|   ->  Seq Scan on bloat_test  (cost=0.00..13758.00 rows=90000 width=0) (actual time=0.020..34.519 rows=90000 loops=1) |
|         Buffers: shared hit=12858                                                                                     |
| Planning Time: 0.156 ms                                                                                               |
| Execution Time: 39.244 ms                                                                                             |
+-----------------------------------------------------------------------------------------------------------------------+
```
This time the count(*) got a sequential scan. Since this is such a small table, it's still relatively quick, finishing at ~39 ms. Notice that the number of pages hit in shared buffers is 12,858, which is significantly fewer than were needed to process the previous versions of this query. 

```bash
> explain (analyze, buffers) select count(marker) from lab.bloat_test;

|-----------------------------------------------------------------------------------------------------------------------|
| Aggregate  (cost=13983.00..13983.01 rows=1 width=8) (actual time=47.776..47.778 rows=1 loops=1)                       |
|   Buffers: shared hit=12858                                                                                           |
|   ->  Seq Scan on bloat_test  (cost=0.00..13758.00 rows=90000 width=4) (actual time=0.069..37.494 rows=90000 loops=1) |
|         Buffers: shared hit=12858                                                                                     |
| Planning:                                                                                                             |
|   Buffers: shared hit=3                                                                                               |
| Planning Time: 0.321 ms                                                                                               |
| Execution Time: 47.836 ms                                                                                             |
+-----------------------------------------------------------------------------------------------------------------------+
```
This plan is nearly identical to the one above it. Individual query run times will vary, but this is now essentially the same as above since it used the same number of pages from shared buffers and had the same plan shape. Again, it required far fewer pages than the previous iteration of this query, which accounts for the majority of the speedup.

```bash
> explain (analyze,buffers) select * from lab.bloat_test where id = 50;

|-------------------------------------------------------------------------------------------------------------------------------|
| Index Scan using bloat_test_pkey on bloat_test  (cost=0.29..8.31 rows=1 width=1048) (actual time=0.224..0.225 rows=0 loops=1) |
|   Index Cond: (id = 50)                                                                                                       |
|   Buffers: shared read=2                                                                                                      |
| Planning:                                                                                                                     |
|   Buffers: shared hit=6                                                                                                       |
| Planning Time: 0.212 ms                                                                                                       |
| Execution Time: 0.260 ms                                                                                                      |
+-------------------------------------------------------------------------------------------------------------------------------+
```
Lastly, our point lookup now performs an index scan. It required 2 pages, likely related to performing the B-tree traversal in the index, and completed in 0.26 ms. This is about 7x as fast as the previous query. 

## Wrapping up
Conclusions? Postgres table bloat can pretty severely impact query performance. Vacuuming it will certainly help, but you may need to take further measures and run pg_repack to regain full performance, and you definitely will need to in order to reclaim the extra disk space. 