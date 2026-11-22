'use strict';

function createVideoRouteHandler({
  env = process.env,
  analyzeVideo,
  analyzeFrames,
  logger = console
} = {}) {
  return async function videoRoute(req, res) {
    const video = String(req.body?.video || req.body?.data || '');
    if (!video) {
      return res.status(400).json({ ok: false, error: 'video or data is required' });
    }

    const apiKey = String(env.DASHSCOPE_API_KEY || env.QWEN_OMNI_API_KEY || '');
    const baseUrl = String(env.QWEN_OMNI_BASE_URL || '').trim();
    const qwenEnabled = env.QWEN_OMNI_ENABLED === '1' && Boolean(apiKey && baseUrl);

    if (qwenEnabled && typeof analyzeVideo === 'function') {
      try {
        const result = await analyzeVideo({
          enabled: true,
          apiKey,
          baseUrl,
          model: env.QWEN_OMNI_MODEL || 'qwen3.8-omni-flash',
          video,
          prompt: req.body?.prompt,
          // The Vercel Hobby function has a short default execution window.
          // Return control to the browser early so it can use frame sampling.
          timeoutMs: env.VERCEL ? 8000 : 180000
        });
        if (result?.available && String(result.result || '').trim()) {
          return res.json({
            ok: true,
            ...result,
            route: 'video',
            analysisMode: 'video_and_audio',
            audioAnalyzed: true
          });
        }
      } catch (error) {
        logger.error('QWEN_OMNI_VIDEO_ERROR', JSON.stringify({
          code: error?.code || 'QWEN_OMNI_FAILED',
          status: error?.status || 502,
          message: String(error?.message || error).slice(0, 240)
        }));
        if (env.VERCEL) {
          return res.status(error?.status || 502).json({
            ok: false,
            error: String(error?.message || 'Qwen video analysis failed'),
            code: error?.code || 'QWEN_OMNI_FAILED'
          });
        }
      }
    }

    // Vercel Functions do not guarantee ffmpeg/ffprobe binaries. If direct
    // video analysis is not configured there, let the browser sample frames.
    if (env.VERCEL) {
      return res.json({
        ok: true,
        available: false,
        code: qwenEnabled ? 'QWEN_OMNI_UNAVAILABLE' : 'QWEN_OMNI_NOT_CONFIGURED'
      });
    }

    if (typeof analyzeFrames !== 'function') {
      return res.status(503).json({ ok: false, error: 'Video frame analysis is unavailable' });
    }

    try {
      const result = await analyzeFrames(video);
      const text = String(result?.result || '').trim();
      if (!text) throw Object.assign(new Error('Анализ выбранных кадров вернул пустой ответ.'), { status: 502 });
      return res.json({
        ok: true,
        available: true,
        route: 'video',
        analysisMode: 'sampled_frames',
        audioAnalyzed: false,
        ...result,
        result: text
      });
    } catch (error) {
      logger.error('VIDEO_FRAME_ANALYSIS_ERROR', String(error?.message || error).slice(0, 240));
      return res.status(error?.status || 502).json({
        ok: false,
        error: String(error?.message || 'Ошибка анализа кадров видео')
      });
    }
  };
}

module.exports = { createVideoRouteHandler };
