import type { AudioInterface } from "./AudioInterface";


interface ConversationCallbacks {
    agentResponse?: (response: string) => void;
    agentResponseCorrection?: (original: string, corrected: string) => void;
    userTranscript?: (transcript: string) => void;
    latencyMeasurement?: (latencyMs: number) => void;
}

export class Conversation {
    private shouldStop: boolean = false;
    private conversationId?: string;
    private lastInterruptId: number = 0;
    private ws?: WebSocket;

    constructor(
        private agentId: string,
        private options: {
            requiresAuth: boolean;
            audioInterface?: AudioInterface;
            callbacks?: ConversationCallbacks;
        }
    ) { }

    async startSession(): Promise<void> {
        const wsUrl = this.getWssUrl();

        const inputCallback = (audio: Buffer) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    user_audio_chunk: audio.toString('base64')
                }));
            }
        };

        this.ws = new WebSocket(wsUrl);
        this.ws.addEventListener('open', () => {
            console.log('11labs WebSocket connection established');
            this.shouldStop = false;
        });

        this.ws.addEventListener('message', (event) => {
            if (this.shouldStop) return;
            
            this.handleMessage(JSON.parse(event.data));
        });

        console.log('11labs - starting audio interface');
        await this.options.audioInterface?.start(inputCallback);
    }

    endSession(): void {
        this.shouldStop = true;
        this.options.audioInterface?.stop();
        this.ws?.close();
    }

    async waitForSessionEnd(): Promise<string | undefined> {
        // Wait for WebSocket to close
        while (this.ws?.readyState === WebSocket.OPEN) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this.conversationId;
    }

    private handleMessage(message: any): void {
        switch (message.type) {
            case "conversation_initiation_metadata":
                const initEvent = message.conversation_initiation_metadata_event;
                this.conversationId = initEvent.conversation_id;
                break;

            case "audio":
                const audioEvent = message.audio_event;
                if (parseInt(audioEvent.event_id) <= this.lastInterruptId) return;
                this.options.audioInterface?.output(Buffer.from(audioEvent.audio_base_64, 'base64'));
                break;

            case "agent_response":
                if (this.options.callbacks?.agentResponse) {
                    const responseEvent = message.agent_response_event;
                    this.options.callbacks.agentResponse(responseEvent.agent_response.trim());
                }
                break;

            case "agent_response_correction":
                if (this.options.callbacks?.agentResponseCorrection) {
                    const correctionEvent = message.agent_response_correction_event;
                    this.options.callbacks.agentResponseCorrection(
                        correctionEvent.original_agent_response.trim(),
                        correctionEvent.corrected_agent_response.trim()
                    );
                }
                break;

            case "user_transcript":
                if (this.options.callbacks?.userTranscript) {
                    const transcriptEvent = message.user_transcription_event;
                    this.options.callbacks.userTranscript(transcriptEvent.user_transcript.trim());
                }
                break;

            case "interruption":
                const interruptEvent = message.interruption_event;
                this.lastInterruptId = parseInt(interruptEvent.event_id);
                this.options.audioInterface?.interrupt();
                break;

            case "ping":
                const pingEvent = message.ping_event;
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: "pong",
                        event_id: pingEvent.event_id,
                    }));
                }
                if (this.options.callbacks?.latencyMeasurement && pingEvent.ping_ms) {
                    this.options.callbacks.latencyMeasurement(parseInt(pingEvent.ping_ms));
                }
                break;
        }
    }

    private getWssUrl(): string {
        return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;
    }

    private async getSignedUrl(): Promise<string> {
      const response = await fetch(
        `v1/convai/conversation/get_signed_url?agent_id=${this.agentId}`,
        { method: "GET" }
      );
      return (await response.json()).signed_url;
    }
}