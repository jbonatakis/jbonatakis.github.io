---
layout: post
title: "Killer Context"
subtitle: "Closing the loop on spec-driven development"
date: 2026-02-07
permalink: /blah/:title/
categories: [thoughts, projects]
unlisted: true
---
> TL;DR: I theorize that coding agent errors compound over time leading to increasingly worse outcomes as a session continues. I built Blackbird based on this theory, which restarts each task in a plan with a fresh context window, with a new task's instructions as its starting point. This minimizes *deviation from intention* leading to better outcomes.

___

> [!NOTE] 
> This post (like all of my posts) was written by a human. 

### The rise of spec-driven development
In my circles, [spec driven development](https://news.ycombinator.com/item?id=45935763) is all the rage. It seems that tools like [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [spec-kit](https://github.com/github/spec-kit) are brought up in nearly every other conversation. I am largely on board. If building with coding agents, I think that clearly defining what you want up front is absolutely necessary. My main issue with it, however, is that most spec driven tools stop short. They define the spec, but they offload the execution of that spec to an agent like Claude Code or Codex. 

You might (reasonably) be thinking, "If you don't want to have an agent build from the spec, then what would you have instead?" Well, of course in the context of agentic spec driven development the agent will be the one implementing the spec. My main qualm comes down to how these tools make that happen. Take for example OpenSpec's [/opsx:apply](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md#opsxapply) command. Its default behavior is to run through the list of tasks one by one, marking them done as it goes. At first glance this is great! You  can spend your time on the high leverage work of defining the spec and offload the scut work of actually implementing that to the agent. Open your agent, `/opsx:apply`, done. But, in my experience, this is where things start to go wrong. 

### Compound interest
As Einstein once said ([or didn't say...](https://skeptics.stackexchange.com/questions/25330/did-einstein-ever-remark-on-compound-interest)), *"Compound interest is the most important invention in all of human history."* Read any financial book or forum and you'll inevitably hear about "getting your money working for you" by taking advantage of compound interest. And it's true, it is a powerful concept that, if on your side, can lead to great benefit. But you need to be careful that it's not actually working *against* you.

This brings us back to `/opsx:apply`. When you run that and let your agent execute your spec task by task, you need to assume some level of variance between *developer intention* and *agentic output*. What you get might be close to what you wanted, but it's unlikely to be exactly what you wanted. With one task this variance can be reasonable. We can actually express this mathematically.

*v* = per-task retained accuracy (for “10% variance”, this is *v*=0.9)

*p<sub><sub>t</sub></sub>* = cumulative correctness after task *t* (normalized so perfect execution = 1.0)

*p<sub><sub>0</sub></sub>* = 1.0 = perfect starting state

So after one task:

*p<sub><sub>1</sub></sub>* ​= *p<sub><sub>0</sub></sub>*​⋅*v* = 1.0⋅0.9 = 0.9

After the second task:

*p<sub><sub>2</sub></sub>*​ = *p<sub><sub>1</sub></sub>*​⋅*v* = 0.9⋅0.9 = 0.81

This is where we start to see what I call ***compound variance*** come into play. The formula generalizes for *t* tasks as:

p<sub><sub>t+1</sub></sub> = p<sub><sub>t</sub></sub>⋅v

Let's visualize this:

![Cumulative variance across tasks](/assets/svg/compound-variance.svg)

<details markdown="1">
<summary>Cumulative accuracy (p<sub>t</sub>) by task count (click to expand)</summary>

| Tasks | *p*<sub>t</sub> (v=0.90, 10% variance) | Deviation | *p*<sub>t</sub> (v=0.97, 3% variance) | Deviation |
| :---: | :------------------------------------: | :-------: | :-----------------------------------: | :-------: |
|   0   |                  1.00                  |    0%     |                 1.00                  |    0%     |
|   1   |                  0.90                  |    10%    |                 0.97                  |    3%     |
|   2   |                  0.81                  |    19%    |                 0.94                  |    6%     |
|   3   |                  0.73                  |    27%    |                 0.91                  |    9%     |
|   4   |                  0.66                  |    34%    |                 0.89                  |    11%    |
|   5   |                  0.59                  |    41%    |                 0.86                  |    14%    |
|  10   |                  0.35                  |    65%    |                 0.74                  |    26%    |
|  15   |                  0.21                  |    79%    |                 0.63                  |    37%    |

</details>

After just 5 tasks with a compounding 10% variance, the outcome will have deviated from a perfect execution by over 40%. By the time you hit 10 tasks the outcome will have deviated from perfect by over 65%. You might be thinking that 10% variance per task is too high, but even if we reduce that to just 3% variance, after 10 tasks the deviation from perfect is ~26%. By the 15th task the deviation is ~37%.

### Context as a liability
Recent releases from some of the largest AI providers have [touted huge context windows](https://www.anthropic.com/news/claude-opus-4-6) as a benefit. The thinking goes that, ostensibly, a larger context window equals greater capability. [But is that really the case](https://community.openai.com/t/large-context-window-what-are-you-using-it-for/1241320)? From the anecdotes of other and my own experiences, often when the context grows too large then the quality of a model's output begins to decrease. This is acknowledged by the same AI providers who are releasing models with these massive context windows. This friction between feature availability and feature capability has led to the rise of [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- essentially designing systems that selectively manage what remains in an agent's context window over time, removing the unnecessary information to keep the agent on track. It's also why you see [entire sections in agent documentation about managing context](https://code.claude.com/docs/en/how-claude-code-works#the-context-window). But this process is imperfect, and Anthropic says it themselves right there:

> As you work, context fills up. Claude compacts automatically, but **instructions from early in the conversation can get lost**.

And [Cursor as well](https://cursor.com/blog/agent-best-practices#managing-context):

> Long conversations can cause the agent to lose focus. After many turns and summarizations, the context accumulates noise and the agent can get distracted or switch to unrelated tasks. If you notice the effectiveness of the agent decreasing, it's time to start a new conversation.

Who is to say that the compaction process won't leave the agent lobotomized, with important information missing and irrelevant information retained, resulting in [poisoned context](https://docs.roocode.com/advanced-usage/context-poisoning)? Bringing it back to spec-driven development, if your context window is compacted midway through your task list (or several times), how confident are you that the quality of the context that remains will lead to optimal outputs? Personally, I'm skeptical of this.   In fact, I believe that compaction will ultimately contribute further to the decline in quality of responses. Consider the chart below:

![Compaction penalty](/assets/svg/compaction-ratio.svg)

Assuming a consistent compaction ratio of 20% (and I acknowledge that this is a simplification), repeated compactions steadily reduce the amount of free space available in the context window. As free space shrinks, compactions necessarily occur more frequently.

In a long-horizon, spec-driven execution, this is especially problematic. By the time execution of a task is underway, the active context already reflects an implementation that has begun  to diverge from original developer intent. Compaction of this context does not revisit or correct that divergence, but instead preserves a compressed snapshot of it.

Subsequent compactions then add additional summaries derived from later stages of the implementation, each of which is itself based on earlier variance. Over time, the context becomes a stack of lossy summaries with no remaining access to the original intent. The result of this is not just information loss, but authority drift: the agent increasingly treats this accumulated history of approximations as ground truth. 

To avoid this negative feedback cycle, my typical workflow has historically included starting a fresh agent session for each task, providing it only high level project information, the details on the new overarching goal of the feature, and the specific task information. I have found that it generally yields strong results. However, there are tradeoffs with this approach versus one long session, mainly:
* It's slower because at the start of each session the agent has no context on your codebase and so must use its tools to search and hydrate it with relevant information
* It's more token hungry because the above rehydration process has to happen for each new task

But, in addition to avoiding the building of a lossy contextual bedrock, it has other benefits too. Recall above the compounding variance chart. Another way to visualize that could be like so:

![Cumulative variance across tasks](/assets/svg/compound-variance-pos-neg.svg)

<details markdown="1">
<summary>Deviation by task (1 − 0.9<sup>t</sup>, v=0.9)</summary>

| Task  | Deviation (±) | % from plan |
| :---: | :-----------: | :---------: |
|   0   |     0.00      |     0%      |
|   1   |     0.10      |     10%     |
|   2   |     0.19      |     19%     |
|   3   |     0.27      |     27%     |
|   4   |     0.34      |     34%     |
|   5   |     0.41      |    ~41%     |

</details>

This shows the variance increasing at an increasing rate as time, measured in tasks completed, goes on. But with a fresh session per task, we get:

![Fresh context variance across tasks](/assets/svg/blackbird-variance-pos-neg.svg)

In this image you see that variance resets to 0 at the start of each new task. This is because all of the context from the previous session is discarded and only relevant information about the task at hand is provided at startup. *Essentially this treats agents as stateless*. By doing this we avoid entirely the  [vicious cycle](https://en.wikipedia.org/wiki/Vicious_circle) of repeated compactions.

### Garbage in, garbage out
All of this is well and good, but it sits on top of one massive assumption: *the plan is an accurate representation of your desired end state*. In other words, it assumes that you've written a good spec and divided that spec up into accurate, detailed tasks that together describe the entire unit of work that you're aiming to build. But what happens if you haven't done that? Well, let's recall our earlier equation for compound variance:

p<sub><sub>t+1</sub></sub> = p<sub><sub>t</sub></sub>⋅v

If we change this up slightly to let `q` equal plan quality, where `q` is between 1-0, and let `t` continue to equal the number of tasks, we can see the impact of the plan quality with the following formula:

p<sub><sub>t</sub></sub> = q ⋅ v<sup><sup>t</sup></sup>

In other words, execution variance compounds exponentially across tasks, while plan quality acts as a hard ceiling on the best possible outcome. That's a pretty intuitive statement actually -- write a bad plan, get a bad result. 

What's the conclusion to draw here?
* OpenSpec has the agent generate the spec
* Variance applies to spec generation too.
* OpenSpec pushes you to let the agent generate the spec.
* It's easy not to edit it once the spec is generated.
* Then an AI generated set of tasks based off of the spec -- even more room for variance. And this is the `q` in the above equation. 
* Conclusions? You *need* to closely revise and edit the spec, as well as the generated plan (blackbird will generate the plan for you from a JSON schema, but it's still susceptible to the same variance). Work to get `q` as close to 1 as possible.

### Comedy of errors
Conclusion/summary

Many things can go wrong
* Per-task variance
* Compounding variance
* Lossy compactions
* Increasing frequency of compactions

We can circumvent all of these except for per-task variance at the cost of a little extra time and a few extra tokens by treating agents as stateless task executors. But by avoiding the others, we're at the same time limiting the per-task variance.