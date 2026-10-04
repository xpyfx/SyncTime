// 永久固定不變的 Windows 筆電媒體伺服器網址
export const MEDIA_SERVER_URL = 'https://mobility-outtakes-tainted.ngrok-free.dev';

/**
 * 萬用圖片/影片上傳函式
 * 可傳入 File 物件或 Base64 字串，回傳可存入 Firebase 的永久網址
 */
export const uploadMediaToPostgres = async (fileOrBase64: File | string | null | undefined): Promise<string> => {
  if (!fileOrBase64) return '';

  let base64Data = '';

  if (typeof fileOrBase64 === 'string') {
    if (fileOrBase64.startsWith('http://') || fileOrBase64.startsWith('https://')) {
      return fileOrBase64;
    }
    base64Data = fileOrBase64;
  } else {
    base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  }

  const response = await fetch(`${MEDIA_SERVER_URL}/api/images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ base64Image: base64Data })
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '媒體上傳失敗');
  }

  return data.url;
};
