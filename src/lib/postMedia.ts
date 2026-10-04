export const MAX_POST_MEDIA = 10;
export const MAX_POST_VIDEO_SECONDS = 60;
const MODERATION_FRAME_WIDTH = 640;
const VIDEO_SAMPLE_COUNT = 10;

export type PostMediaKind = 'image' | 'video';

export interface MediaModerationResult {
  allowed: boolean;
  categories: string[];
  reason?: string;
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = url;
  });

const canvasFrame = (
  source: CanvasImageSource,
  width: number,
  height: number,
  maxWidth = MODERATION_FRAME_WIDTH
) => {
  const scale = Math.min(1, maxWidth / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
};

export const getVideoDuration = async (file: File): Promise<number> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('VIDEO_METADATA_FAILED'));
    });

    return Number.isFinite(video.duration) ? video.duration : 0;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const createImageModerationFrames = async (file: File): Promise<string[]> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    return [canvasFrame(image, image.naturalWidth, image.naturalHeight)];
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.onseeked = null;
      video.onerror = null;
    };

    video.onseeked = () => {
      cleanup();
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('VIDEO_SEEK_FAILED'));
    };

    const safeTime = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.05)));
    if (Math.abs(video.currentTime - safeTime) < 0.02) {
      cleanup();
      resolve();
      return;
    }
    video.currentTime = safeTime;
  });

const createVideoModerationFrames = async (file: File): Promise<string[]> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('VIDEO_DATA_FAILED'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error('VIDEO_DURATION_UNAVAILABLE');

    const frameCount = Math.min(
      VIDEO_SAMPLE_COUNT,
      Math.max(3, Math.ceil(duration / 6))
    );

    const frames: string[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const fraction = frameCount === 1 ? 0 : index / (frameCount - 1);
      await seekVideo(video, duration * fraction);
      frames.push(canvasFrame(video, video.videoWidth, video.videoHeight));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const moderatePostMedia = async (
  file: File,
  kind: PostMediaKind
): Promise<MediaModerationResult> => {
  const frames =
    kind === 'image'
      ? await createImageModerationFrames(file)
      : await createVideoModerationFrames(file);

  const response = await fetch('/api/moderate/media', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mediaType: kind,
      fileName: file.name,
      frames
    })
  });

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      // Ignore invalid error bodies.
    }

    const error = new Error(
      payload?.userMessage ||
      payload?.code ||
      payload?.error ||
      'MEDIA_MODERATION_UNAVAILABLE'
    );
    (error as any).code = payload?.code;
    (error as any).details = payload?.details;
    (error as any).userMessage = payload?.userMessage;
    throw error;
  }

  const result = await response.json();
  return {
    allowed: result.allowed === true,
    categories: Array.isArray(result.categories) ? result.categories : [],
    reason: typeof result.reason === 'string' ? result.reason : undefined
  };
};
