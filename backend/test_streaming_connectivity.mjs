import 'dotenv/config';
import fs from 'fs';
import WebSocket from 'ws';

const apiKey = process.env.SARVAM_API_KEY?.trim();
const wavBuffer = fs.readFileSync('test_tts_en.wav');
const pcmBuffer = wavBuffer.subarray(44);

async function testFinalEvent() {
  return new Promise((resolve) => {
    const url = 'wss://api.sarvam.ai/speech-to-text-realtime/ws?language_code=en-IN&sample_rate=16000&encoding=linear16';
    const ws = new WebSocket(url, { headers: { 'api-subscription-key': apiKey } });

    ws.on('open', () => console.log('Connected'));
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event !== 'transcript.partial') {
        console.log('>>> Non-partial event:', JSON.stringify(msg));
      }
      if (msg.event === 'session.begin') {
        // Send 1 second speech in 100ms slices (3200 bytes each)
        for (let i = 0; i < 10; i++) {
          const slice = pcmBuffer.subarray(i * 3200, (i + 1) * 3200);
          ws.send(JSON.stringify({ event: 'audio_input', audio: slice.toString('base64') }));
        }

        // Send 1.5 seconds silence in 100ms slices
        const zeroSlice = Buffer.alloc(3200);
        for (let i = 0; i < 15; i++) {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'audio_input', audio: zeroSlice.toString('base64') }));
            }
          }, (i + 1) * 100);
        }
      }
    });

    setTimeout(() => {
      ws.close();
      resolve(true);
    }, 6000);
  });
}

testFinalEvent().then(() => process.exit(0));
