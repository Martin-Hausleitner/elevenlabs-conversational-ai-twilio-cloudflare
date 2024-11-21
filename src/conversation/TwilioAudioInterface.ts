// twilioAudioInterface.ts
import { WebSocket } from "ws";
import type { AudioInterface } from "./AudioInterface";

interface TwilioStartEvent {
  event: 'start';
  start: {
    streamSid: string;
  };
}

interface TwilioMediaEvent {
  event: 'media';
  streamSid?: string;
  media: {
    payload: string;
  };
}

interface TwilioClearEvent {
  event: 'clear';
  streamSid: string;
}

const WebSocket_OPEN = 1;

export type TwilioEvent = TwilioStartEvent | TwilioMediaEvent | TwilioClearEvent;

export class TwilioAudioInterface implements AudioInterface {
  private streamSid: string | null = null;
  private inputCallback: ((audio: Buffer) => void) | null = null;

  constructor(private websocket: WebSocket) {
  }

  async start(inputCallback: (audio: Buffer) => void) {
    this.inputCallback = inputCallback;
  }

  stop(): void {
    this.streamSid = null;
    console.log("T: Stopping audio processing");
  }

  output(audio: Buffer): void {
    this.executeSendAudioToTwilio(audio.toString('base64')).catch(err =>
      console.error('Error sending audio:', err)
    );
  }

  interrupt(): void {
    this.sendClearMessageToTwilio().catch(err => 
      console.error('Error sending clear message:', err)
    );
  }

  private async executeSendAudioToTwilio(audioPayload: string): Promise<void> {
    try {
      const audioEvent: TwilioMediaEvent = {
        event: 'media',
        streamSid: this.streamSid ?? undefined,
        media: {
          payload: audioPayload
        }
      };

      if (this.websocket.readyState === WebSocket_OPEN) {
        this.websocket.send(JSON.stringify(audioEvent));
      } else {
        console.error('T: WebSocket not open');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Queue timeout') {
        throw error;
      }
      console.error('Error sending audio:', error);
    }
  }

  private async sendClearMessageToTwilio(): Promise<void> {
    try {
      if (!this.streamSid) return;

      const clearEvent: TwilioClearEvent = {
        event: 'clear',
        streamSid: this.streamSid
      };

      if (this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(clearEvent));
      }
    } catch (error) {
      console.error('Error sending clear message to Twilio:', error);
    }
  }

  async handleTwilioMessage(data: TwilioEvent): Promise<void> {
    try {
      if (data.event === 'start') {
        this.streamSid = data.start.streamSid;
        
        console.log(`T: Started stream with stream_sid: ${this.streamSid}`);
      }
      
      if (data.event === 'media' && this.inputCallback) {
        const audioData = Buffer.from(data.media.payload, 'base64');
        this.inputCallback(audioData);
      }
      // console.log('Received Twilio message:', data.event);
    } catch (error) {
      if (error instanceof Error && error.message.includes('WebSocket')) {
        this.stop();
        this.streamSid = null;
        console.log('T: WebSocket closed, stopping audio processing');
      } else {
        console.error('Error in input callback:', error);
      }
    }
  }
}