---
layout: post
title: "Vibe coding but better"
author: Jack Bonatakis
date: 2026-01-20
permalink: /blah/:title/
categories: projects
---
> TL;DR -- 
> I built [blackbird](https://github.com/jbonatakis/blackbird), a CLI tool to break your work down into manageable chunks that Claude Code or Codex can follow easily. Then I used that to build [key-keeper](https://github.com/jbonatakis/key-keeper), a browser extension to securely share API keys with websites.

---

I do a lot of informal "spec driven development". My workflow tends to be:

1. Have a conversation with ChatGPT about my idea, talking through technology, pitfalls, features, etc.
2. Have ChatGPT generate a product spec for me. This is focused on *what* I'm going to build, rather than *how* I'll build it.
3. Have ChatGPT break the product spec from step 2 down into manageable chunks of work. 
4. Move to Cursor or Codex and have it work its way through the chunks defined in previous step. Additionally I'll have Cursor/Codex do a code review in a separate context window and address the points it raises as needed.

At the end of that process I usually have something usable. It's pretty manual though, and I wanted something a little better. Instead of moving to a tool like [spec-kit](https://github.com/github/spec-kit), I decided to build my own tool to formalize my process. 

It's still very much in progress, but that has resulted in [blackbird](https://github.com/jbonatakis/blackbird). `blackbird` will take your project summary and generate a JSON plan for it, defining dependencies and keeping track of the status of each task. An example of an actual plan is below:

<details>
<summary>Click to see plan</summary>

{% highlight json %}
{
  "schemaVersion": 1,
  "items": {
    "background-handler": {
      "id": "background-handler",
      "title": "Implement background request handler",
      "description": "Create the background service worker logic that receives requests via Port connections, validates origin/policies, checks rate limits, retrieves API keys, routes to provider adapters, and sends back responses (streaming or non-streaming).",
      "acceptanceCriteria": [
        "Listens for runtime.onConnect for Port connections",
        "Validates origin and policies for each request",
        "Checks rate limits before executing",
        "Retrieves valid API key for provider",
        "Routes request to correct provider adapter",
        "Sends single response or streams chunks back via Port",
        "Handles errors gracefully with clear messages"
      ],
      "prompt": "Implement the background service worker (background.js) that handles incoming Port connections from content scripts, validates requests through origin validator and rate limiter, executes operations via provider registry, and returns results or streams chunks back to the page.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "origin-validator",
        "rate-limiter",
        "provider-registry",
        "storage-service",
        "ttl-manager"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:40:19.241668Z",
      "depRationale": {
        "origin-validator": "Needs to validate requests against policies",
        "provider-registry": "Needs to route requests to provider adapters",
        "rate-limiter": "Needs to enforce rate limits",
        "storage-service": "Needs to retrieve API keys and check TTL",
        "ttl-manager": "Background script initializes TTL manager alarms"
      }
    },
    "content-script": {
      "id": "content-script",
      "title": "Create content script for page communication",
      "description": "Implement a content script that injects a client library into approved web pages, exposes the postMessage API to the page, and forwards requests to the background script via runtime.connect.",
      "acceptanceCriteria": [
        "Content script injected into allowed origins",
        "Exposes window API for page scripts to call",
        "Establishes long-lived Port connection to background",
        "Forwards requests and responses between page and background",
        "Handles streaming responses via Port messages"
      ],
      "prompt": "Create a content script (content-script.js) that exposes a window API for web pages to send LLM operation requests, establishes a Port connection to the background script, and forwards messages bidirectionally, handling both single responses and streaming chunks.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "protocol-schema"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:34:33.793417Z",
      "depRationale": {
        "protocol-schema": "Must implement the defined protocol for page communication"
      }
    },
    "manifest": {
      "id": "manifest",
      "title": "Create manifest.json for MV3",
      "description": "Define the Manifest V3 configuration supporting both Chrome and Firefox with required permissions (storage, alarms for TTL), background service worker, and options page.",
      "acceptanceCriteria": [
        "manifest_version: 3 specified",
        "Permissions include storage, alarms",
        "Background service_worker entry points to background.js",
        "Options page configured",
        "Cross-browser compatible structure"
      ],
      "prompt": "Create a manifest.json file for a Manifest V3 WebExtension that works in both Chrome and Firefox. Include permissions for storage and alarms, configure a background service worker (background.js), and declare an options page (options.html).",
      "parentId": null,
      "childIds": [],
      "deps": [],
      "status": "todo",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:33:10.01707Z"
    },
    "manifest-content-scripts": {
      "id": "manifest-content-scripts",
      "title": "Configure content scripts in manifest",
      "description": "Update manifest.json to declare content script injection rules, initially requiring explicit origin configuration via options (no automatic injection to all sites).",
      "acceptanceCriteria": [
        "Content scripts section added to manifest",
        "Injection matches based on configured origins (dynamic if possible)",
        "Security best practices followed",
        "Run_at timing configured appropriately"
      ],
      "prompt": "Update manifest.json to configure content script injection for the content-script.js file, setting appropriate match patterns that will be controlled by the origin allowlist configured in options.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "manifest",
        "content-script"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:34:51.796573Z",
      "depRationale": {
        "content-script": "Needs the content script to exist first",
        "manifest": "Modifies the manifest file"
      }
    },
    "openai-adapter": {
      "id": "openai-adapter",
      "title": "Implement OpenAI provider adapter",
      "description": "Create the first concrete provider adapter for OpenAI that implements the provider interface, handles responses.create operation, and supports both streaming and non-streaming responses.",
      "acceptanceCriteria": [
        "Implements provider adapter interface",
        "Supports responses.create operation mapping to OpenAI chat completions",
        "Handles streaming responses via SSE",
        "Handles non-streaming responses",
        "Proper error handling for API failures"
      ],
      "prompt": "Implement an OpenAI provider adapter (openai-adapter.js) that implements the provider interface, maps responses.create to OpenAI chat completions API, and handles both streaming and non-streaming responses.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "provider-interface"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:35:15.646306Z",
      "depRationale": {
        "provider-interface": "Must implement the defined interface"
      }
    },
    "options-ui-html": {
      "id": "options-ui-html",
      "title": "Create options page HTML structure",
      "description": "Build the HTML structure for the options page with sections for managing API keys, TTL settings, origin allowlists, and per-origin/provider policies.",
      "acceptanceCriteria": [
        "Sections for API key management per provider",
        "TTL configuration input",
        "Origin allowlist management (add/remove)",
        "Per-origin/provider policy editor",
        "Clear, user-friendly layout"
      ],
      "prompt": "Create an options page HTML file (options.html) with sections for adding/removing API keys per provider with TTL, managing the origin allowlist, and configuring per-origin/provider policies including allowed operations, token caps, and streaming settings.",
      "parentId": null,
      "childIds": [],
      "deps": [],
      "status": "todo",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:33:31.991147Z"
    },
    "options-ui-script": {
      "id": "options-ui-script",
      "title": "Implement options page JavaScript",
      "description": "Create the JavaScript for the options page that loads current settings from storage, handles form submissions to save keys/TTL/policies, and updates the UI dynamically.",
      "acceptanceCriteria": [
        "Loads current keys, TTL, allowlist, policies on page load",
        "Saves API keys with provider and TTL to storage",
        "Adds/removes origins from allowlist",
        "Updates per-origin/provider policies",
        "Validates inputs before saving",
        "Provides user feedback on save success/failure"
      ],
      "prompt": "Implement the options page JavaScript (options.js) that uses the storage service to load and save API keys with TTL, manage the origin allowlist, and configure per-origin/provider policies with proper validation and user feedback.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "options-ui-html",
        "storage-service"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:37:15.939659Z",
      "depRationale": {
        "options-ui-html": "Needs HTML structure to manipulate",
        "storage-service": "Uses storage service to persist settings"
      }
    },
    "origin-validator": {
      "id": "origin-validator",
      "title": "Implement origin validation module",
      "description": "Create a module that validates incoming requests against the origin allowlist and checks per-origin/provider policies before allowing operations.",
      "acceptanceCriteria": [
        "Validates origin against allowlist",
        "Checks if operation is allowed for origin/provider combo",
        "Returns clear error messages for policy violations",
        "Uses storage service to read policies"
      ],
      "prompt": "Implement an origin validator module (origin-validator.js) that checks if a request origin is in the allowlist and if the requested operation is allowed per the origin/provider policies stored in the storage service.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "storage-service",
        "protocol-schema"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:37:33.179362Z",
      "depRationale": {
        "protocol-schema": "Must understand request structure to validate",
        "storage-service": "Needs to read allowlist and policies from storage"
      }
    },
    "protocol-schema": {
      "id": "protocol-schema",
      "title": "Define postMessage protocol schema",
      "description": "Document the versioned postMessage protocol schema including request format (version, operation, provider, params), response format (success/error, data), and streaming message format.",
      "acceptanceCriteria": [
        "Request message structure documented with version field",
        "Operation names standardized (e.g., responses.create)",
        "Response message structure for success/error",
        "Streaming chunk message format defined",
        "Error codes and messages standardized"
      ],
      "prompt": "Design and document the versioned postMessage protocol schema for communication between web pages and the extension, including request/response formats, operation names, streaming messages, and error handling.",
      "parentId": null,
      "childIds": [],
      "deps": [],
      "status": "todo",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:33:55.900533Z"
    },
    "provider-interface": {
      "id": "provider-interface",
      "title": "Define provider adapter interface",
      "description": "Create a TypeScript/JSDoc interface and base class for provider adapters that standardizes how to execute provider-agnostic operations (e.g., responses.create) against different AI vendors.",
      "acceptanceCriteria": [
        "Interface defines executeOperation(operation, params, apiKey) method",
        "Interface supports streaming and non-streaming responses",
        "Clear contract for operation names and parameters",
        "Documentation for adding new providers"
      ],
      "prompt": "Define a provider adapter interface (provider-adapter.js) with JSDoc that specifies how provider adapters should implement executeOperation for different LLM operations, supporting both streaming and non-streaming responses.",
      "parentId": null,
      "childIds": [],
      "deps": [],
      "status": "todo",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:33:38.012629Z"
    },
    "provider-registry": {
      "id": "provider-registry",
      "title": "Create provider registry",
      "description": "Implement a registry that maps provider names to their adapter instances and provides a lookup function for the background script.",
      "acceptanceCriteria": [
        "Registry maps provider names to adapter instances",
        "Function to get adapter by provider name",
        "OpenAI adapter registered by default",
        "Easy to extend with new providers"
      ],
      "prompt": "Create a provider registry (provider-registry.js) that maintains a map of provider names to adapter instances and provides a getAdapter(providerName) function. Register the OpenAI adapter.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "openai-adapter"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:35:26.889567Z",
      "depRationale": {
        "openai-adapter": "Needs at least one adapter to register"
      }
    },
    "rate-limiter": {
      "id": "rate-limiter",
      "title": "Implement rate limiter module",
      "description": "Create a rate limiter that tracks token usage per origin/provider and enforces token caps defined in policies, resetting counters periodically.",
      "acceptanceCriteria": [
        "Tracks token usage per origin/provider",
        "Enforces token caps from policies",
        "Rejects requests exceeding limits",
        "Periodic reset of counters (e.g., daily)",
        "Returns remaining quota information"
      ],
      "prompt": "Implement a rate limiter module (rate-limiter.js) that tracks token usage per origin/provider, enforces caps from policies, and provides functions to check/update quota and reset counters periodically.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "storage-service"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:37:53.627333Z",
      "depRationale": {
        "storage-service": "Needs to persist and read rate-limit counters"
      }
    },
    "storage-schema": {
      "id": "storage-schema",
      "title": "Design storage schema for keys and policies",
      "description": "Define the structure for storing API keys (provider, key, TTL, expiry timestamp), origin allowlists, per-origin/provider policies (allowed operations, token caps, streaming), and rate-limit counters in storage.local.",
      "acceptanceCriteria": [
        "Schema supports multiple providers",
        "Keys include TTL and expiry timestamp",
        "Origin allowlist structure defined",
        "Per-origin/provider policies include operations, token caps, streaming flag",
        "Rate-limit counters structure defined"
      ],
      "prompt": "Design and document the storage.local schema for API keys (with provider, key, TTL, expiry), origin allowlists, per-origin/provider policies (allowed operations, token caps, streaming), and rate-limit tracking.",
      "parentId": null,
      "childIds": [],
      "deps": [],
      "status": "todo",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:32:06.625804Z"
    },
    "storage-service": {
      "id": "storage-service",
      "title": "Implement storage service module",
      "description": "Create a storage service that provides async functions to read/write keys, check TTL expiry, manage origin allowlists, and read/write per-origin/provider policies and rate-limit data.",
      "acceptanceCriteria": [
        "Functions to get/set API keys by provider",
        "TTL expiry check returns valid/expired status",
        "Functions to add/remove/check origins in allowlist",
        "Functions to get/set per-origin/provider policies",
        "Functions to get/set rate-limit counters",
        "Uses chrome.storage.local API"
      ],
      "prompt": "Implement a storage service module (storage-service.js) that wraps chrome.storage.local and provides functions for managing API keys with TTL, origin allowlists, per-origin/provider policies, and rate-limit data.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "storage-schema"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:36:02.45537Z",
      "depRationale": {
        "storage-schema": "Must know the schema structure before implementing storage operations"
      }
    },
    "testing-strategy": {
      "id": "testing-strategy",
      "title": "Document testing and example usage",
      "description": "Create documentation with examples of how to use the extension from a web page, how to configure it, and a simple test page for validating functionality.",
      "acceptanceCriteria": [
        "Example web page that calls the extension API",
        "Documentation on protocol usage",
        "Instructions for configuring the extension",
        "Example of streaming and non-streaming requests",
        "Setup guide for development/testing"
      ],
      "prompt": "Create a README.md with usage documentation and a test.html example page that demonstrates how to call the extension API for both streaming and non-streaming LLM operations, along with setup instructions.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "protocol-schema"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:38:18.831685Z",
      "depRationale": {
        "protocol-schema": "Documentation should reflect the defined protocol"
      }
    },
    "ttl-manager": {
      "id": "ttl-manager",
      "title": "Implement TTL expiry manager with alarms",
      "description": "Create a TTL manager that uses chrome.alarms to schedule periodic checks for expired API keys and automatically removes them from storage.",
      "acceptanceCriteria": [
        "Alarm created on extension startup",
        "Periodic check (e.g., every hour) for expired keys",
        "Expired keys removed from storage",
        "Alarm listener registered in background script"
      ],
      "prompt": "Implement a TTL manager (ttl-manager.js) that uses chrome.alarms API to periodically check for expired API keys and remove them from storage using the storage service.",
      "parentId": null,
      "childIds": [],
      "deps": [
        "storage-service"
      ],
      "status": "blocked",
      "createdAt": "2026-01-20T00:00:00Z",
      "updatedAt": "2026-01-20T23:38:34.219734Z",
      "depRationale": {
        "storage-service": "Needs storage service to check and remove expired keys"
      }
    }
  }
}
{% endhighlight %}
</details>

You'll notice that this plan contains numerous steps, each listing its status, dependencies, parents, children, and other metadata. This is generated under the hood by passing the execution to Claude Code along with the JSON schema that we expect. I plan to eventually support Codex and other AI CLI tools as well.

Now we can use `blackbird` to see what to work on first by running `blackbird list`:
![blackbird list screenshot](https://raw.githubusercontent.com/jbonatakis/jbonatakis.github.io/master/site/assets/images/blackbird-list.png)

Each of these tasks are a root level task, don't depend on any other work, and unblock other work as they're completed. This filtering provides a natural ordering for how a project should be built. Eventually I'd like to also add in parallel execution. For now though this is all that `blackbird` does -- generate a plan. 

However, if you pair it with Claude Code or Codex, it works surprisingly well. In fact, I generated the plan above using `blackbird` in order to build out another idea I had, a project I'm calling ([for now...](https://martinfowler.com/bliki/TwoHardThings.html)) **[key-keeper](https://github.com/jbonatakis/key-keeper)**.

---

I've had a lot of idea for web apps to build that had AI core to their function and for which I had no intention of charging users. I was never quite sure how to go about doing that though. Do I use *my* API key and incur all the cost for anyone who uses the site? That sounds like a great way for a Chinese bot to rack up a huge bill for me. No, that's out.

Do I go with a BYOK approach and ask users to trust me with the proper treatment of their keys? Even in an auditable open-source project I would personally not trust that, so that's out as well. 

`key-keeper` is a browser extension that solves this problem. Instead of having an app request a key from a user directly, `key-keeper` stores the API key in extension storage that is inaccessible to any script running in the browser and allows users to set access policies on that key by origin and operation, as well as provide a TTL. Then instead of making requests directly to AI providers like OpenAI, an app can call the extension, which, if allowed by a policy, proxies the request using the saved key and returns the response to the app. 

Here's a sample request:

```javascript
const prompt = "Hello from test page.";
try {
    const result = await window.keyKeeper.request({
        version: 1,
        operation: "responses.create",
        provider: "openai",
        params: {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        },
});
    console.log("Result:", result);
} catch (error) {
    console.error("Error:", error);
}
```

The security conscious reader will note that, while I've successfully hidden the API key from the webpage, the extension itself could still be doing somethign nefarious with the key. There's no way around this, and it's definitely true. But it's a *mitigation*. Instead of every page and every developer holding up three fingers and saying, "scout's honor, I won't misuse this key" `key-keeper` consolidates that risk into one central location. One person/application to trust rather than many, one person to hold accountable, one code base to scrutinze. It's not perfect, but I think it's better.

Anyway, it seems to work great -- and the best part is that the entirety of the v1 version of `key-keeper` was built by feeding the plan from above to Codex, telling it that `blackbird` exists, and asking it to build the app.  

Codex was able to figure out the CLI commands by running `blackbird help` and then mark tasks as completed as it progressed by running `blackbird set-status <id> done`. It could also run `blackbird list` at any point to figure out what to work on next. Once `blackbird list` had no output Codex knew it was done.

It took Codex about 7 minutes to build a functioning version of `key-keeper` working off of the plan generated by `blackbird`. It's no joke to say that I could have built `key-keeper` at least 10x while writing this post. To be honest I'm a bit blown away by that. The plan is not the most detailed thing in the world. It was generated off of this input:

> Build a MV3 WebExtension (Chrome + Firefox) that stores user-provided API keys per provider in `storage.local` with TTL-based expiry, exposes a versioned `postMessage` protocol that lets approved website origins request provider-agnostic LLM operations (e.g., `operation="responses.create"`), and routes those requests through a background/service worker that enforces origin allowlists, per-origin/provider policies (allowed operations, token caps, streaming enablement) and rate limits before executing the actual provider HTTP call (OpenAI first) and returning either a single result or a streamed sequence of chunks back to the page via a long-lived Port, with an options UI to manage keys, TTL, allowed sites, and limits, and a provider adapter interface to add additional AI vendors without changing the page-facing API.

I gave Codex no instructions while it was building. [Here's the commit that represents the actual output from Codex](https://github.com/jbonatakis/key-keeper/commit/009ab676c651edf8c77d8bce2b160449279f3442). All I've done since (as of writing) is some cleanup and a build step. And here is `key-keeper` running in Firefox:

![key-keeper options](https://raw.githubusercontent.com/jbonatakis/jbonatakis.github.io/master/site/assets/images/key-keeper-options.png)


![key-keeper test page](https://raw.githubusercontent.com/jbonatakis/jbonatakis.github.io/master/site/assets/images/key-keeper-test-page.png)

In fact I haven't even taken time to read the code. *I still don't really know how to build a browser extension*. 


