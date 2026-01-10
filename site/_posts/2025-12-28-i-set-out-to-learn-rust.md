---
layout: post
title: "I set out to learn Rust"
author: Jack Bonatakis
date: 2025-12-28
permalink: /blah/:title/
categories: projects
---

...and I guess I got a little distracted, because I built a POC document ingestion and vector search app instead.

### Document Processing and Ingestion
First is the document ingestion layer. In its current form this specifically downloads the markdown files that comprise [The Book](https://doc.rust-lang.org/book/),
but can be expanded out ingest other content later as well. Once it downloads the markdown files it uses the OpenAI API to embed them. I'm using the `text-embeddings-3-small`
model for this. The `small` version is cheaper than the `large` version, and yields vectors of smaller dimensions by default (1,536 vs 3,072), however the dimension are
[configurable](https://platform.openai.com/docs/api-reference/embeddings/create#embeddings_create-dimensions) so really using the `large` version would have been fine too. 
Regardless, the smaller number of dimensions is useful for storing embeddings in `pgvector` as the `vector` datatype can store a maximum of 2,000 dimensions by default. Another
option could have been to use the `large` model with the full 3,072 dimensions and use a `halfvec` datatype in `pgvector`. Instead of storing the full 32 bit float for each
dimension in the vector, `halfvec` *quantizes* the 32 bit floats down to 16 bits. This doubles the dimensions allowed to be stored thus enabling use of models like `text-embeddings-3-large`
in their full capacity.   

Notably absent in this stage is any kind of content chunking. Chunking is the process of splitting a larger document into smaller documents. In this case, it would be splitting an entire chapter
of The Book into chunks perhaps based on section, header, etc. There are several ways to go about chunking:
- Character based chunking: splitting the input based solely on the number of characters (perhaps splitting sentences or even words)
- Recursive chunking: splitting the input based on smaller and smaller units (sections, paragraphs, sentences, words, etc) until achieving a chunk udner some configured character or token threshold
- Semantic chunking: splitting the input based on the meaning of the document. This keeps together related pieces of the input regardless of the physical structure of the text

And more. I think chunking is *critical* to any real RAG application, but I didn't want to get caught up on that here. I think it will be a good focus for later learning. 

### Storage
Next is the database. This is standard Postgres with the `pgvector` extension enabled. Database migrations are managed via `dbmate`, a nice migration framework that
enables and encourages the use of raw SQL instead of an ORM. I've created one table, `embeddings`, defined as:
```sql
CREATE TABLE embeddings (
    id BIGSERIAL PRIMARY KEY,
    content_name varchar(255) NOT NULL,
    content text NOT NULL,
    embedding vector(1536) NOT NULL
);
```

This allows for storing the named content and its embedding together for easy retrieval. In a production application it would likely be beneficial to separate the contents from the embeddings
so that these can be indexed (as well `VACUUM` and `ANALYZE`) independently, but for now this is fine.

I used [bun's built in SQL bindings](https://bun.com/docs/runtime/sql) to create a Postgres client. This is a no-frills SQL client that can connect to a number of systems. I'm primarily a Python
developer, so it was nice to not have to search for a good SQL client and just use some functionality built into the runtime. 

### API
Finally there is the API. There is one endpoint that takes in a text input, embeds it, and runs a similarty search against contents from The Book. It returns a variable
number of results, but by default will only return one result. It's a pretty light wrapper around the OpenAI embeddings endpoint:

```typescript
async generateEmbedding(model: string, input: string): Promise<number[]> {
  const response = await this.client.embeddings.create({
    model: model,
    input: input,
  });

  const embedding = response.data[0]?.embedding;

  if (!embedding) {
    throw new Error("Failed to embed input");
  }

  return embedding;
}
```

And then we do the in-database comparison:

```sql
SELECT 
    id, 
    content_name AS "contentName", 
    content, 
    embedding 
FROM embeddings
ORDER BY embedding <=> ${vectorLiteral} -- cosine distance between the input embedding and the values in the `embedding` column
LIMIT ${limit};
``` 

Note that in this query we're using the `<=>` operator  which is the `pgvector` shorthand for cosine distance. With this the smaller the resulting value is, the closer (aka more similar)
the two compared values are. To get true cosine *similarity*, we'd take the inverse: `1 - cosine_distance`. Then the *larger* the value the more similar the inputs would be. 

As noted in the `pgvector` documentation, if the embeddings being used are normalized to length 1, as OpenAI embeddings are, then you can/should instead use inner product (`<#>`)
to compare embeddings, since it will yield the same result but with less computation. See my [braindump on vector embeddings](https://jack.bonatak.is/some-notes-about-vector-embeddings/)
for (a little) more detail on how that works. I didn't learn this until *after* I was already using cosine distance, so this is something I would go back and change if I were to update this system.

## Putting it together
Now that we have the ingestion, the storage, and the API, we can test it out. After running the ingestion offline, and then starting the API, we can hit the `/similar` endpoint:

```bash
curl -s -X POST "http://localhost:3000/similar" \
  -H "Content-Type: application/json" \
  -d '{"text": "How does Rust deal with memory management?", "numRecords": 1}' | jq 
```

which returns:

```json
[
  {
    "contentName": "ch04-00-understanding-ownership.md",
    "content": "# Understanding Ownership\n\nOwnership is Rust’s most unique feature and has deep implications for the rest\nof the language. It enables Rust to make memory safety guarantees without\nneeding a garbage collector, so it’s important to understand how ownership\nworks. In this chapter, we’ll talk about ownership as well as several related\nfeatures: borrowing, slices, and how Rust lays data out in memory.\n"
  }
]
```

All in all it's a pretty naive/barebones RAG stack, but this was a good primer on getting set up with embeddings, vector databases, and similarity search. Next steps? Maybe I'll actually work on
learning Rust like I initally set out to do. 


