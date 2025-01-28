import React, { useState } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from '@firebase/functions';
import { useAuth } from '../contexts/AuthContext';

interface TTSResponse {
  success: boolean;
  audioContent: string;
  fileName: string;
}

const TextToSpeech: React.FC = () => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to use this feature');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const synthesizeSpeech = httpsCallable<any, TTSResponse>(functions, 'synthesizeSpeechFn');
      const result = await synthesizeSpeech({
        text,
        languageCode: 'en-GB',
        voiceName: 'en-GB-Journey-F',
        speakingRate: 1.0,
        pitch: 0
      });

      if (result.data.success && result.data.audioContent) {
        setAudioUrl(`data:audio/mp3;base64,${result.data.audioContent}`);
      } else {
        throw new Error('Failed to get audio content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'speech.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Text to Speech Converter</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="w-full p-3 border rounded-lg min-h-[150px]"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !text.trim()}
          className={`w-full py-2 px-4 rounded-lg text-white ${
            isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Converting...' : 'Convert to Speech'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {audioUrl && (
        <div className="mt-6 space-y-4">
          <audio controls className="w-full">
            <source src={audioUrl} type="audio/mp3" />
            Your browser does not support the audio element.
          </audio>
          
          <button
            onClick={handleDownload}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            Download Audio
          </button>
        </div>
      )}
    </div>
  );
};

export default TextToSpeech;
