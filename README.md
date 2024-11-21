# 11labs-twillio

This is a a Typescript implementation of the [11 Labs Twilio integration](https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-twilio) originally written in python.

It let's you connect your Elevenlabs Conversational AI agent to a twilio number.

This is setup to run on Cloudflare. 

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

Set the AGENT_ID:

```bash
bun run set-secret AGENT_ID
```


## Step by step

1: Install dependencies:
```bash
bun install
```

2: Elevenlabs agent creation

Go to https://elevenlabs.io/app/conversational-ai and create a new, public agent.
You can just use one of their examples, like the wizard.

Then copy the Agent ID (you can find it under the Agent name in).

Also, under **Voice** you have to select “μ-law 8000 Hz” and under 
**Advanced** > User input select “μ-law 8000 Hz”

If in doubt, follow https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-twilio

3: Create a Cloudflare account.

If you don't have a Cloudflare account, go and create one, it's free.


4: Set he AGENT_ID:

```bash 
bun run set-secret AGENT_ID
```

Then paste the AGENT_ID from Elevenlabs

5: Publish

```bash
bun run deploy
```

This will first ask you to authenticate your *wrangler* (the tool used by Cloudflare) cli 
to cloudflare. It should open a browser window, click accept, and the console should continue.

Then it will publish the the code and spit out a URL for the deployment:

```
Total Upload: 5517.69 KiB / gzip: 424.01 KiB
Worker Startup Time: 61 ms
Uploaded 11labs-twilio (6.04 sec)
Deployed 11labs-twilio triggers (0.40 sec)
  https://11labs-twilio.<YOUR ACCOUNT>.workers.dev
Current Version ID: <UUID>
```

Now, copy that URL, and go to Twilio.

6: Setup a Twilio account, generate a new number for Voice.

Then go to config, and add the URL to: "A call comes in" Webhook:
https://11labs-twilio.<YOUR ACCOUNT>.workers.dev/incoming-call-eleven


Dial you number, and you should be good.