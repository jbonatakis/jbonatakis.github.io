---
layout: post
title:  "Some notes about vector embeddings"
date:   2025-12-12
permalink: /:title/
categories: notes
---

- Text (or other content, like images, with the right model) can be *embedded* returning a vector
- Most LLM providers have embeddings models/endpoints that can take input and return a vector
- Vectors are represented as arrays of numbers (generally 32-bit floats)
- They have a magnitude
    - This is the length of the vector. Length is NOT the number of components in the vector -- that's dimension, and is usually fixed per-model (512, 1536, etc)
- They also have a direction
    - This is the actual numerical encoding of the meaning of the input
- Normalization of vectors results in removing the impact of magnitude on similarity
- Regarding similarity, similarity of vectors can be calculated multiple ways
- Two very common ways are *cosine similarity* and *inner product similarity* (aka Dot Product)
- For normalized vectors, cosine and inner product similarity are the same. This is because normalization yields a denominator of 1 in the cosine calculation.
    - The numerator of the cosine similarity calculation *is* the inner product calculation
- Inner product calculation: A * B
    - A: `[2,3,4]`
    - B: `[5,4,3]`
    - Inner product: `(2*5) + (3*4) + (4*3)`
- Cosine simlarity: `A * B / ||A||*||B||`
    - Double bars (`||`) means the *length* or *norm* of a vector
    - This is calculated by taking the square root of the sum of squares for the vector
    - Eg. `[2,3,4] = sqrt((2^2) + (3^2) + (4^2)) = sqrt(4+9+16) = sqrt(29)`
- To normalize a vector, divide every component by its length:
    - Eg. `[2,3,4]` --> Length of sqrt(29) as seen above, so normalized:
    - `[(2/sqrt(29)), (3/sqrt(29)), (4/sqrt(29))] ~ [0.3714, 0.5571, 0.7428]`
- Most embedding methods return 32-bit floats
    - Eg. 0.01610957272350788
- In a vector database, a vector can be *quantized*, and stored as 16 bit values by using a halfvec data type
    - This might be specific to pg_vector?
    - So 0.01610957272350788 becomes something like 0.01611328125
- Halfvec are *almost* the exact same value, but consume half the storage space
- This reduces disk requirements and also increases computation speed with minimal impact on the result
- Pair halfvec with inner product on normalized vectors (since cosine similarity on normalized vectors is the exact same result but with extra computation) for increased performance when comparing vectors

