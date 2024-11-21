import { Hono, type Context } from 'hono';
import twilio from 'twilio';
import { TwilioAudioInterface, type TwilioEvent } from './conversation/TwilioAudioInterface';
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import { Conversation } from './conversation/Conversation';
import { createMiddleware } from 'hono/factory';


type AppType = {
    Bindings: {
        AGENT_ID: string,
    }
}

const app = new Hono<AppType>();
const VoiceResponse = twilio.twiml.VoiceResponse
const envCheckMiddleware = createMiddleware((c, next) => {
    if (!c.env.AGENT_ID) {
        console.error('Agent ID not configured');
        throw new Error('Environment not configured');
    }
    return next();
})
app.use(envCheckMiddleware);

// Root endpoint
app.get('/', (c) => c.json({ message: 'Twilio-ElevenLabs Integration Server' }));

// Handle incoming Twilio calls
app.post('/incoming-call-eleven', async (c) => {
    const response = new VoiceResponse();
    const host = new URL(c.req.url).hostname;

    console.log("Incoming call from Twilio");

    const connect = response.connect();
    connect.stream({
        url: `wss://${host}/media-stream-eleven`,
    });

    return new Response(response.toString(), {
        headers: { 'Content-Type': 'application/xml' }
    });
});

// WebSocket endpoint for media streaming
app.get('/media-stream-eleven', upgradeWebSocket((async (c: Context<AppType>) => {

    console.log('WebSocket connection requested');
    let audioInterface: TwilioAudioInterface;
    let conversation: Conversation | null = null;

    return {
        onMessage(evt, ws) {
            if (!evt.data) return;

            if (!conversation) {
                audioInterface = new TwilioAudioInterface(ws.raw!);
                conversation = new Conversation(c.env.AGENT_ID, {
                    audioInterface,
                    requiresAuth: false,
                    callbacks: {
                        agentResponse: (text) => console.log(`Agent said: ${text}`),
                        userTranscript: (text) => console.log(`User said: ${text}`)
                    }
                })
                c.executionCtx.waitUntil((async () => {
                    console.log('Conversation session started');
                    await conversation!.startSession();
                    console.log('Conversation session ended')
                })())
            }

            const data: TwilioEvent = JSON.parse(evt.data as string);
            audioInterface.handleTwilioMessage(data).catch((error) => {
                console.error('Error processing message:', error);
            });

        },
        onClose(evt, ws) {
            console.log('WebSocket disconnected');
            if (conversation) {
                const conv = conversation as Conversation;
                console.log('Ending conversation session...');
                conv.endSession();
                conv.waitForSessionEnd();
            }
        }

    };
})
));

// Error handling middleware
app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
});

export default {
    fetch: app.fetch
};