import { transcribeAudio, SttError } from "../utils/stt";


const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_SEC = 600;

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event);
  if (!form || !form.length) {
    throw createError({ statusCode: 400, statusMessage: "Нет файла аудио" });
  }

  const audioPart = form.find((p) => p.name === "audio");
  if (!audioPart?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "Нет файла аудио" });
  }

  if (audioPart.data.length > MAX_AUDIO_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "Аудио больше 25 МБ — запишите короче",
    });
  }

  const durationHeader = Number(form.find((p) => p.name === "durationSec")?.data.toString() ?? 0);
  if (durationHeader > MAX_DURATION_SEC) {
    throw createError({
      statusCode: 413,
      statusMessage: "Запись длиннее 10 минут — запишите короче",
    });
  }

  const mime = audioPart.type || "audio/webm";
  const ext = mime.includes("wav")
    ? "wav"
    : mime.includes("mpeg")
      ? "mp3"
      : mime.includes("ogg")
        ? "ogg"
        : "webm";

  try {
    const result = await transcribeAudio(
      new Blob([new Uint8Array(audioPart.data)], { type: mime }),
      `recording.${ext}`,
    );

    if (!result.text) {
      return {
        ok: false as const,
        code: "empty_transcript",
        message: "Речь не распознана. Попробуйте записать ещё раз или введите текст.",
      };
    }

    return {
      ok: true as const,
      text: result.text,
      durationSec: result.durationSec,
      cost: result.cost,
    };
  } catch (e) {
    if (e instanceof SttError) {
      throw createError({ statusCode: e.status ?? 502, statusMessage: e.message });
    }
    throw e;
  }
});
