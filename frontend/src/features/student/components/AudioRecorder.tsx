// src/features/student/components/AudioRecorder.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square } from "lucide-react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export default function AudioRecorder({
  onRecordingComplete,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ownedBlobUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onRecordingCompleteRef.current = onRecordingComplete;

  const revokeOwnedBlobUrl = useCallback(() => {
    if (ownedBlobUrlRef.current) {
      URL.revokeObjectURL(ownedBlobUrlRef.current);
      ownedBlobUrlRef.current = null;
    }
  }, []);

  const stopMediaResources = useCallback(() => {
    const activeRecorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (activeRecorder) {
      activeRecorder.ondataavailable = null;
      activeRecorder.onstop = null;
      if (activeRecorder.state !== "inactive") {
        try {
          activeRecorder.stop();
        } catch {}
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopMediaResources();
      revokeOwnedBlobUrl();
    };
  }, [revokeOwnedBlobUrl, stopMediaResources]);

  const startRecording = async () => {
    try {
      stopMediaResources();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null;
        }
        recorder.ondataavailable = null;
        recorder.onstop = null;
        stream.getTracks().forEach((track) => track.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        if (!isMountedRef.current) return;

        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        revokeOwnedBlobUrl();
        ownedBlobUrlRef.current = url;
        setAudioUrl(url);
        onRecordingCompleteRef.current(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      stopMediaResources();
      if (isMountedRef.current) {
        setIsRecording(false);
        alert("Vui lòng cấp quyền truy cập Microphone để thực hiện bài nói.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
          >
            <Mic size={16} /> Bắt đầu ghi âm
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="flex animate-pulse items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Square size={16} /> Dừng ghi âm
          </button>
        )}

        {audioUrl && (
          <audio src={audioUrl} controls className="h-9 w-64 rounded" />
        )}
      </div>
      {isRecording && (
        <span className="text-xs text-rose-500 font-medium">
          ● Đang thu âm câu trả lời Speaking...
        </span>
      )}
    </div>
  );
}
