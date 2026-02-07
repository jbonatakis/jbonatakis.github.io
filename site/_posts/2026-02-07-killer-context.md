---
layout: post
title: "Killer Context"
subtitle: "Closing the loop on spec-driven development"
date: 2026-02-07
permalink: /blah/:title/
categories: [thoughts, projects]
unlisted: true
---

> [!NOTE] 
> This is a draft.

> [!NOTE] 
> This post (like all of my posts) is written by a human.

___

> TL;DR: coding agent errors compound over time leading to increasingly worse outcomes as a session continues. Blackbird restarts each task in a plan with a fresh context window, with a new task's instructions as its starting point. This minimizes *deviation from intention* leading to better outcomes.

___

Thoughts
- Stateless agents
- Existing agentic coding assistants are really good and only going to get better, but we need to solve for context
- Blackbird composes together agent sessions with a fresh context
- It's a tradeoff:
	- Guarantee of no poisoned or bloated context
	- Agent is slower because it needs to do all of the startup tasks and rehydrate relevant information

Assumptions
- LLMs/coding agents are imperfect
- In a long running process with multiple tasks, this imperfection compounds
- Bad context "poisons" future outcomes
- The plan, if executed perfectly, will result in a perfect outcome
	- This assume that the plan is perfect. If you, the developer, leave the creation of the plan entirely to the agent, you're baking in n% inaccuracy from the start
		- This compounds with the n% inaccuracy from each step in the plan! n=10% so from a perfect (100%) plan, after one step you're at 90%. But if the plan is only 90% perfect, after one step you're at 81%. 


Draft

### The rise of spec-driven development
In my circles, [spec driven development](https://news.ycombinator.com/item?id=45935763) is all the rage. It seems that tools like [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [spec-kit](https://github.com/github/spec-kit) are brought up in nearly every other conversation. I am largely on board. If building with coding agents, I think that clearly defining what you want up front is absolutely necessary. ~~In fact, I think it's a great practice even if not building with an agent.~~ My main issue with it, however, is that most spec driven tools stop short. They define the spec, but they offload the execution of that spec to an agent like Claude Code or Codex. 

You might (reasonably) be thinking, "If you don't want to have an agent build from the spec, then what would you have instead?" Well, of course in the context of agentic spec driven development the agent will be the one implementing the spec. My main qualm comes down to how these tools make that happen. Take for example OpenSpec's [/opsx:apply](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md#opsxapply) command. Its default behavior is to run through the list of tasks one by one, marking them done as it goes. At first glance this is great! You  can spend your time on the high leverage work of defining the spec and offload the scut work of actually implementing that to the agent. Open your agent, `/opsx:apply`, done. But, in my experience, this is where things start to go wrong. 

### Compound interest
As Einstein once said ([or didn't say...](https://skeptics.stackexchange.com/questions/25330/did-einstein-ever-remark-on-compound-interest)), *"Compound interest is the most important invention in all of human history."* Read any financial book or forum and you'll inevitably hear about "getting your money working for you" by taking advantage of compound interest. And it's true, it is a powerful concept that, if on your side, can lead to great benefit. But you need to be careful that it's not actually working *against* you.

This brings us back to `/opsx:apply`. When you run that and let your agent execute your spec task by task, you need to assume some level of variance between *developer intention* and *agentic output*. What you get might be close to what you wanted, but it's unlikely to be exactly what you wanted. With one task this variance can be reasonable. We can actually express this mathematically.

*v* = per-task retained accuracy (for “10% variance”, this is *v*=0.9)

*p<sub>t</sub>* = cumulative correctness after task *t* (normalized so perfect execution = 1.0)

*p<sub>0</sub>* = 1.0 = perfect starting state

So after one task:

*p<sub>1</sub>* ​= *p<sub>0</sub>*​⋅*v* = 1.0⋅0.9 = 0.9

After the second task:

*p<sub>2</sub>*​ = *p<sub>1</sub>*​⋅*v* = 0.9⋅0.9 = 0.81

This is where we start to see what I call ***compound variance*** come into play. The formula generalizes for *t* tasks as:

p<sub>t+1</sub> = p<sub>t</sub>⋅v

Let's visualize this:

![Cumulative variance across tasks](/assets/svg/compound-variance.svg)
> 
> **insert collapsible table underneath**


After just 5 tasks with a compounding 10% variance, the outcome will have deviated from a perfect execution by over 40%. By the time you hit 10 tasks the outcome will have deviated from perfect by over 65%. You might be thinking that 10% variance per task is too high, but even if we reduce that to just 3% variance, after 10 tasks the deviation from perfect is ~27%. By the 15th task the deviation is ~37%.

### Context as a liability

Recent releases from some of the largest AI providers have [touted huge context windows](https://www.anthropic.com/news/claude-opus-4-6) as a benefit. The thinking goes that, ostensibly, a larger context window equals greater capability. [But is that really the case?](https://community.openai.com/t/large-context-window-what-are-you-using-it-for/1241320). From the anecdotes of other and my own experiences, often when the context grows too large then the quality of a model's output begins to decrease. This is acknowledged by the same AI providers who are releasing models with these massive context windows. This friction between feature availability and feature capacity has led to the rise of [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- essentially designing systems that selectively manage what remains in an agent's context window over time, removing the unnecessary information to keep the agent on track. It's also why you see [entire sections in agent documentation about managing context](https://code.claude.com/docs/en/how-claude-code-works#the-context-window). But this process is imperfect, and Anthropic says it themselves right there:

> As you work, context fills up. Claude compacts automatically, but **instructions from early in the conversation can get lost**.

Who is to say that the compaction process won't leave the agent lobotomized, with important information missing and irrelevant information retained, resulting in [poisoned context](https://docs.roocode.com/advanced-usage/context-poisoning)? Bringing it back to spec-driven development, if your context window is compacted midway through your task list, how confident are you that the quality of the context that remains will lead to optimal outputs? Personally, I'm skeptical of this. 


* Relying on large context windows to execute multiple tasks is actually a net negative

* Instead eschew relying on massive context windows. Throw out your context for each task. Treat agents as stateless.

So what is there to do? Well, one idea is to think of each task as a discrete unit of work deserving of its own context. We start a fresh session of our chosen agent for each task, feeding it whatever context it needs up front to get started. 
