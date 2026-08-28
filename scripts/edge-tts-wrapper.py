#!/usr/bin/env python3
"""Edge TTS wrapper: reads JSON from stdin, outputs MP3 to stdout"""
import sys, json, asyncio, edge_tts

async def main():
    data = json.load(sys.stdin)
    text = data['text']
    voice = data.get('voice', 'zh-CN-XiaoxiaoNeural')
    rate = data.get('rate', '+0%')

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    async for chunk in communicate.stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])

if __name__ == '__main__':
    asyncio.run(main())
