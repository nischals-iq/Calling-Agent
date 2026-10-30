import 'dotenv/config';
import fs from 'fs';
import WebSocket from 'ws';

const apiKey = process.env.SARVAM_API_KEY?.trim();

async function inspectCodec(codec) {
  console.log(`\n================ Testing output_audio_codec: "${codec}" ================`);
  return new Promise((resolve) => {
    const url = 'wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v4-flash&send_completion_event=true';
    const ws = new WebSocket(url, { headers: { 'api-subscription-key': apiKey } });

    const chunks = [];

    ws.on('open', () => {
      console.log(`Connected with codec: ${codec}`);
      ws.send(JSON.stringify({
        type: 'config',
        data: {
          language_code: 'en-IN',
          speaker: 'simran_en_customer',
          output_audio_codec: codec,
        },
      }));

      ws.send(JSON.stringify({
        type: 'text',
        data: { text: 'Hello, I am testing audio playback.' },
      }));

      ws.send(JSON.stringify({ type: 'flush' }));
    });

    ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'audio') {
        const rawBuf = Buffer.from(parsed.data.audio, 'base64');
        chunks.push(rawBuf);
        console.log(`Chunk #${chunks.length}: ${rawBuf.length} bytes. Header ascii: "${rawBuf.subarray(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.')}"`);
      } else if (parsed.type === 'event') {
        console.log('Event frame:', JSON.stringify(parsed));
        ws.close();
        
        // Concatenate buffers properly in binary
        const fullBuffer = Buffer.concat(chunks);
        console.log(`Total buffer for ${codec}: ${fullBuffer.length} bytes.`);
        fs.writeFileSync(`test_out_${codec}.${codec === 'linear16' ? 'pcm' : codec}`, fullBuffer);
        
        // Inspect WAV header if wav
        if (codec === 'wav' && fullBuffer.length >= 44) {
          const riff = fullBuffer.subarray(0, 4).toString('ascii');
          const wave = fullBuffer.subarray(8, 12).toString('ascii');
          const sampleRate = fullBuffer.readUInt32LE(24);
          const numChannels = fullBuffer.readUInt16LE(22);
          const bitsPerSample = fullBuffer.readUInt16LE(34);
          console.log(`WAV header inspection: RIFF=${riff}, WAVE=${wave}, sampleRate=${sampleRate}, channels=${numChannels}, bitsPerSample=${bitsPerSample}`);
        }
        resolve(fullBuffer);
      } else {
        console.log('Other frame:', JSON.stringify(parsed));
      }
    });

    ws.on('error', (err) => {
      console.error('Error with codec', codec, err.message);
      resolve(null);
    });

    setTimeout(() => {
      ws.close();
      resolve(null);
    }, 6000);
  });
}

async function run() {
  await inspectCodec('wav');
  await inspectCodec('mp3');
  process.exit(0);
}

run();
