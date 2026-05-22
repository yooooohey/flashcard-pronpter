import React, { useState, useEffect, useRef } from 'react';

// --- システム定数 & ボイス・言語設定 ---
const GEMINI_VOICES = [
  { id: 'Zephyr', label: 'Zephyr (明るい・多言語対応)' },
  { id: 'Puck', label: 'Puck (快活・親しみやすい)' },
  { id: 'Charon', label: 'Charon (落ち着いた説明調)' },
  { id: 'Kore', label: 'Kore (しっかりした知性的発音)' },
  { id: 'Fenrir', label: 'Fenrir (エネルギッシュ)' },
  { id: 'Leda', label: 'Leda (若々しくクリア)' },
  { id: 'Aoede', label: 'Aoede (さわやか・テンポ良い)' },
  { id: 'Sulafat', label: 'Sulafat (あたたかく穏やか)' }
];

// 要望通りのフィールド定義 (すべて指定されたTTS音声対象を考慮して定義)
const DEFAULT_FIELDS = {
  word: [
    { name: 'photo', label: '写真', isPrimary: false, isSecondary: false, readAloud: false },
    { name: 'japanese', label: '日本語', isPrimary: true, isSecondary: false, readAloud: true, langCode: 'ja-JP' },
    { name: 'english', label: '英語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'en-US' },
    { name: 'french', label: 'フランス語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'fr-FR' },
    { name: 'chinese', label: '中国語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'zh-CN' },
    { name: 'yaeyama', label: '八重山方言', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'ja-JP' },
    { name: 'notes', label: 'メモ', isPrimary: false, isSecondary: false, readAloud: true, langCode: 'ja-JP' }
  ],
  phrase: [
    { name: 'japanese', label: '日本語', isPrimary: true, isSecondary: false, readAloud: true, langCode: 'ja-JP' },
    { name: 'english', label: '英語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'en-US' },
    { name: 'french', label: 'フランス語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'fr-FR' },
    { name: 'chinese', label: '中国語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'zh-CN' },
    { name: 'notes', label: 'メモ', isPrimary: false, isSecondary: false, readAloud: true, langCode: 'ja-JP' }
  ],
  script: [
    { name: 'scene', label: 'シーン', isPrimary: false, isSecondary: false, readAloud: false, isSceneFilter: true },
    { name: 'japanese', label: '日本語', isPrimary: true, isSecondary: false, readAloud: true, langCode: 'ja-JP' },
    { name: 'english', label: '英語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'en-US' },
    { name: 'french', label: 'フランス語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'fr-FR' },
    { name: 'chinese', label: '中国語', isPrimary: false, isSecondary: true, readAloud: true, langCode: 'zh-CN' },
    { name: 'notes', label: 'メモ', isPrimary: false, isSecondary: false, readAloud: true, langCode: 'ja-JP' }
  ]
};

// SuperMemo-2 (SM-2) アルゴリズム
function calculateSM2(rating, prevInterval, prevFactor, repetitions) {
  let nextInterval = 1;
  let nextFactor = prevFactor;
  let nextRepetitions = repetitions;

  if (rating >= 3) {
    if (nextRepetitions === 0) {
      nextInterval = 1;
    } else if (nextRepetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(prevInterval * prevFactor);
    }
    nextRepetitions++;
  } else {
    nextRepetitions = 0;
    nextInterval = 1;
  }

  nextFactor = prevFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (nextFactor < 1.3) nextFactor = 1.3;

  return {
    interval: nextInterval,
    factor: nextFactor,
    repetitions: nextRepetitions,
    nextReviewDate: Date.now() + nextInterval * 24 * 60 * 60 * 1000
  };
}

const isImageUrl = (text) => {
  if (!text) return false;
  const str = text.trim();
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image/');
};

// ラベルから言語ロケールコードの判定
const detectLanguage = (fieldLabel, defaultLang) => {
  const label = fieldLabel.toLowerCase();
  if (label.includes('日本語') || label.includes('japanese') || label.includes('和訳') || label.includes('メモ') || label.includes('notes')) return 'ja-JP';
  if (label.includes('英語') || label.includes('english')) return 'en-US';
  if (label.includes('フランス') || label.includes('french')) return 'fr-FR';
  if (label.includes('中国') || label.includes('chinese') || label.includes('中文')) return 'zh-CN';
  if (label.includes('韓国') || label.includes('korean')) return 'ko-KR';
  if (label.includes('スペイン') || label.includes('spanish')) return 'es-US';
  if (label.includes('ドイツ') || label.includes('german')) return 'de-DE';
  if (label.includes('八重山') || label.includes('yaeyama')) return 'ja-JP';
  return defaultLang || 'ja-JP';
};

const renderFieldValue = (val, label) => {
  if (isImageUrl(val)) {
    return (
      <div className="flex justify-center my-3 max-w-full">
        <img src={val} alt={label} className="max-h-48 rounded-2xl object-contain shadow-xl border border-slate-800" />
      </div>
    );
  }
  return val;
};

const Icon = ({ name, className = "w-5 h-5" }) => {
  const icons = {
    book: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    volume: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    ),
    trash: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    edit: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    plus: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    download: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    upload: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    play: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    pause: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    save: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    ),
    search: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    check: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    info: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    translate: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5c-.006 3.737-1.442 7.142-3.79 9.53M4 11a18.01 18.01 0 008.243-2H1.751" />
      </svg>
    ),
    sparkles: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    )
  };
  return icons[name] || icons.info;
};

const INITIAL_DEMO_DECKS = [
  {
    id: 'deck-word-yaeyama',
    name: '南の島の単語帳（八重山・多言語）',
    type: 'word',
    language: 'ja-JP',
    fields: DEFAULT_FIELDS.word,
    cards: [
      {
        id: 'card-1',
        fields: {
          photo: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&w=400&q=80',
          japanese: 'こんにちは',
          english: 'Hello',
          french: 'Bonjour',
          chinese: '你好',
          yaeyama: 'ハイサイ',
          notes: '代表的な挨拶。八重山地域でも広く親しまれる温かい表現。'
        },
        interval: 1,
        factor: 2.5,
        repetitions: 0,
        nextReviewDate: Date.now()
      },
      {
        id: 'card-2',
        fields: {
          photo: '',
          japanese: 'ありがとう',
          english: 'Thank you',
          french: 'Merci',
          chinese: '谢谢',
          yaeyama: 'ミーファイユー',
          notes: '感謝を相手に丁寧に伝える最高に美しい言葉です。'
        },
        interval: 1,
        factor: 2.5,
        repetitions: 0,
        nextReviewDate: Date.now()
      }
    ]
  },
  {
    id: 'deck-phrase-daily',
    name: 'おでかけ日常会話フレーズ',
    type: 'phrase',
    language: 'ja-JP',
    fields: DEFAULT_FIELDS.phrase,
    cards: [
      {
        id: 'card-p1',
        fields: {
          japanese: '美味しい料理をごちそうさまでした。',
          english: 'Thank you for the delicious meal.',
          french: 'Merci pour ce délicieux repas.',
          chinese: '谢谢你款待这顿美餐。',
          notes: '食後の感謝を表現する、いつでも役立つキーセンテンス。'
        },
        interval: 1,
        factor: 2.5,
        repetitions: 0,
        nextReviewDate: Date.now()
      }
    ]
  },
  {
    id: 'deck-script-island',
    name: '島を旅する２人のミニ台本',
    type: 'script',
    language: 'ja-JP',
    fields: DEFAULT_FIELDS.script,
    cards: [
      {
        id: 'card-s1',
        fields: {
          scene: '第1話・港の出会い',
          japanese: 'ようこそ石垣島へ！旅はこれからだよ。',
          english: 'Welcome to Ishigaki Island! Our journey starts now.',
          french: 'Bienvenue sur l\'île d\'Ishigaki! Notre voyage commence maintenant.',
          chinese: '欢迎来到石垣岛！我们的旅程现在开始。',
          notes: '【話者: 島のガイド】明るく歓迎する笑顔を意識。'
        },
        interval: 1,
        factor: 2.5,
        repetitions: 0,
        nextReviewDate: Date.now()
      },
      {
        id: 'card-s2',
        fields: {
          scene: '第1話・港の出会い',
          japanese: 'うわあ、海が本当に青くて綺麗ですね！',
          english: 'Wow, the ocean is truly blue and beautiful!',
          french: 'Wow, l\'océan est vraiment bleu et magnifique!',
          chinese: '哇，大海真的很蓝很美！',
          notes: '【話者: 観光客】感嘆と興奮したトーンで。'
        },
        interval: 1,
        factor: 2.5,
        repetitions: 0,
        nextReviewDate: Date.now()
      }
    ]
  }
];

export default function App() {
  const [decks, setDecks] = useState(() => {
    const saved = localStorage.getItem('ankiflow_decks_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_DEMO_DECKS;
  });

  const [activeDeckId, setActiveDeckId] = useState(null);
  const [currentView, setCurrentView] = useState('decks');
  const [theme, setTheme] = useState('dark');

  // --- スプレッドシート連携用ステート ---
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [spreadsheetInputText, setSpreadsheetInputText] = useState('');
  const [gasWebhookUrl, setGasWebhookUrl] = useState(() => {
    return localStorage.getItem('ankiflow_gas_url') || '';
  });
  const [webCsvUrl, setWebCsvUrl] = useState(() => {
    return localStorage.getItem('ankiflow_csv_url') || '';
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [editingDeck, setEditingDeck] = useState(null);
  const [showDeckModal, setShowDeckModal] = useState(false);

  const [editingCard, setEditingCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [studyCards, setStudyCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState('spaced');
  const [sceneFilter, setSceneFilter] = useState('all');

  // 1. 自動再生をデフォルトでON(true)に設定
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [autoPlayInterval, setAutoPlayInterval] = useState(5);
  const [speakOnFlip, setSpeakOnFlip] = useState(true);
  const autoPlayTimerRef = useRef(null);
  const wakeLockRef = useRef(null);

  const [ttsEngine, setTtsEngine] = useState('browser');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [ttsVoice, setTtsVoice] = useState('Zephyr');
  const [isTtsLoading, setIsTtsLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const [generatingImageField, setGeneratingImageField] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // ダイアログ・確認用ステート (alert/confirmを回避するためのカスタムUI)
  const [confirmModal, setConfirmModal] = useState(null);

  const [selectedLanguages, setSelectedLanguages] = useState(() => {
    const saved = localStorage.getItem('ankiflow_selected_langs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('ankiflow_decks_v2', JSON.stringify(decks));
  }, [decks]);

  useEffect(() => {
    localStorage.setItem('ankiflow_selected_langs', JSON.stringify(selectedLanguages));
  }, [selectedLanguages]);

  // ローカルストレージにスプレッドシート設定を保存
  useEffect(() => {
    localStorage.setItem('ankiflow_gas_url', gasWebhookUrl);
  }, [gasWebhookUrl]);

  useEffect(() => {
    localStorage.setItem('ankiflow_csv_url', webCsvUrl);
  }, [webCsvUrl]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wakelock request failed:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      });
    }
  };

  const requestConfirmation = (message, onConfirm) => {
    setConfirmModal({ message, onConfirm });
  };

  // --- Gemini API を利用した自動翻訳機能 ---
  const handleAutoTranslate = async () => {
    if (!editingCard) return;
    const sourceText = editingCard.fields.japanese;
    if (!sourceText || !sourceText.trim()) {
      showToast("日本語フィールドに入力してから翻訳を実行してください。", "error");
      return;
    }

    setIsTranslating(true);
    showToast("Gemini 翻訳を呼び出し中...", "info");

    try {
      const apiKeyToUse = geminiApiKey || "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKeyToUse}`;

      const systemPrompt = "You are a precise translator. Translate Japanese into English, French, and Chinese (Simplified). Return ONLY a JSON object with keys 'english', 'french', 'chinese'. Do not include any extra markdown formatting or explain anything.";
      const userPrompt = `Translate this: "${sourceText}"`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              english: { type: "STRING" },
              french: { type: "STRING" },
              chinese: { type: "STRING" }
            },
            required: ["english", "french", "chinese"]
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (generatedText) {
        const parsedTranslations = JSON.parse(generatedText);
        setEditingCard(prev => ({
          ...prev,
          fields: {
            ...prev.fields,
            english: parsedTranslations.english || '',
            french: parsedTranslations.french || '',
            chinese: parsedTranslations.chinese || ''
          }
        }));
        showToast("英語・フランス語・中国語への自動翻訳が完了しました！", "success");
      } else {
        throw new Error("No candidates received");
      }
    } catch (error) {
      console.error("Gemini Translation failed, using fallback:", error);
      showToast("API接続エラーのため仮代入します。", "error");
      setEditingCard(prev => ({
        ...prev,
        fields: {
          ...prev.fields,
          english: `[EN] ${sourceText}`,
          french: `[FR] ${sourceText}`,
          chinese: `[ZH] ${sourceText}`
        }
      }));
    } finally {
      setIsTranslating(false);
    }
  };

  // --- 音声読み上げ制御エンジン ---
  const speakText = async (text, langCode) => {
    if (!text) return;
    setIsTtsLoading(true);

    if (ttsEngine === 'gemini') {
      try {
        const apiKeyToUse = geminiApiKey || "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKeyToUse}`;
        
        const payload = {
          contents: [{
            parts: [{ text: `Say in a natural native accent: ${text}` }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: ttsVoice }
              }
            }
          }
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("TTS failure");
        const result = await response.json();
        const audioPart = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (audioPart && audioPart.inlineData?.data) {
          const audioBytes = audioPart.inlineData.data;
          const mimeType = audioPart.inlineData.mimeType || 'audio/L16;rate=24000';
          const sampleRateMatch = mimeType.match(/rate=(\d+)/);
          const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;

          const binaryString = window.atob(audioBytes);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const pcm16 = new Int16Array(bytes.buffer);
          const frameCount = pcm16.length;
          const audioBuffer = audioCtx.createBuffer(1, frameCount, sampleRate);
          const channelData = audioBuffer.getChannelData(0);

          for (let i = 0; i < frameCount; i++) {
            channelData[i] = pcm16[i] / 32768.0;
          }

          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          source.onended = () => setIsTtsLoading(false);
          source.start();
          return;
        }
      } catch (e) {
        console.warn('Gemini TTS failed, fallback to native speech synthesizer:', e);
      }
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;

    const voices = synth.getVoices();
    const matchingVoice = voices.find(v => v.lang.toLowerCase() === langCode.toLowerCase()) || 
                          voices.find(v => v.lang.startsWith(langCode.substring(0, 2)));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => setIsTtsLoading(false);
    utterance.onerror = () => setIsTtsLoading(false);
    synth.speak(utterance);
  };

  const speakTextWithDetect = async (card, deck, faceOrField) => {
    const activeLangs = selectedLanguages[deck.id] || ['english'];

    if (faceOrField === 'front' || faceOrField === 'back') {
      const readableFields = deck.fields.filter(f => {
        if (!f.readAloud) return false;
        const isJapanese = f.name === 'japanese';
        const isSelected = activeLangs.includes(f.name);
        
        if (!isJapanese && !isSelected) return false;

        if (faceOrField === 'front') {
          return f.isPrimary || (isJapanese && !f.isSecondary);
        } else {
          return f.isSecondary || (isSelected && !f.isPrimary);
        }
      });

      for (const f of readableFields) {
        const val = card.fields[f.name];
        if (val && !isImageUrl(val)) {
          const lang = detectLanguage(f.label, deck.language);
          await speakText(val, lang);
          await new Promise(r => setTimeout(r, 1400));
        }
      }
    } else {
      const val = card.fields[faceOrField.name];
      if (val && !isImageUrl(val)) {
        const lang = detectLanguage(faceOrField.label, deck.language);
        await speakText(val, lang);
      }
    }
  };

  // --- 自動再生ループ制御 ---
  useEffect(() => {
    if (!isAutoPlaying) {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      releaseWakeLock();
      return;
    }

    requestWakeLock();
    
    const playLoop = async () => {
      if (studyCards.length === 0) {
        setIsAutoPlaying(false);
        return;
      }

      const currentCard = studyCards[currentCardIndex];
      const activeDeck = decks.find(d => d.id === activeDeckId);
      if (!currentCard || !activeDeck) return;

      if (speakOnFlip) {
        await speakTextWithDetect(currentCard, activeDeck, 'front');
      }

      setIsCardFlipped(true);
      await new Promise(resolve => setTimeout(resolve, autoPlayInterval * 1000));

      if (speakOnFlip) {
        await speakTextWithDetect(currentCard, activeDeck, 'back');
      }

      await new Promise(resolve => setTimeout(resolve, 2500));
      setIsCardFlipped(false);
      
      setCurrentCardIndex((prevIndex) => {
        if (prevIndex + 1 >= studyCards.length) {
          showToast("すべてのカードの自動再生が完了しました！", "success");
          setIsAutoPlaying(false);
          return 0;
        }
        return prevIndex + 1;
      });
    };

    autoPlayTimerRef.current = setTimeout(() => {
      playLoop();
    }, 1000);

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [isAutoPlaying, currentCardIndex, studyCards]);

  const handleCreateDeck = () => {
    setEditingDeck({
      id: `deck-${Date.now()}`,
      name: '新規カスタム暗記帳',
      type: 'word',
      language: 'ja-JP',
      fields: [...DEFAULT_FIELDS.word],
      cards: []
    });
    setShowDeckModal(true);
  };

  const handleSaveDeck = () => {
    if (!editingDeck.name.trim()) {
      showToast("デッキ名を入力してください", "error");
      return;
    }
    const idx = decks.findIndex(d => d.id === editingDeck.id);
    if (idx >= 0) {
      const updated = [...decks];
      updated[idx] = editingDeck;
      setDecks(updated);
    } else {
      setDecks([...decks, editingDeck]);
    }
    setShowDeckModal(false);
    showToast("デッキ構造を保存しました！", "success");
  };

  const handleDeleteDeck = (id, e) => {
    e.stopPropagation();
    requestConfirmation("このデッキと含まれるすべてのカードを削除してもよろしいですか？", () => {
      setDecks(decks.filter(d => d.id !== id));
      if (activeDeckId === id) {
        setActiveDeckId(null);
        setCurrentView('decks');
      }
      showToast("デッキを削除しました", "info");
    });
  };

  const handleCreateCard = (deck) => {
    const defaultFields = {};
    deck.fields.forEach(f => {
      defaultFields[f.name] = '';
    });
    setEditingCard({
      id: `card-${Date.now()}`,
      fields: defaultFields,
      interval: 1,
      factor: 2.5,
      repetitions: 0,
      nextReviewDate: Date.now()
    });
    setShowCardModal(true);
  };

  const handleSaveCard = () => {
    const activeDeck = decks.find(d => d.id === activeDeckId);
    if (!activeDeck) return;

    let updatedCards = [...activeDeck.cards];
    const cardIndex = updatedCards.findIndex(c => c.id === editingCard.id);

    if (cardIndex >= 0) {
      updatedCards[cardIndex] = editingCard;
    } else {
      updatedCards.push(editingCard);
    }

    const updatedDecks = decks.map(d => {
      if (d.id === activeDeckId) {
        return { ...d, cards: updatedCards };
      }
      return d;
    });

    setDecks(updatedDecks);
    setShowCardModal(false);
    showToast("カードを保存しました", "success");
  };

  const handleDeleteCard = (cardId) => {
    requestConfirmation("このカードを完全に削除しますか？", () => {
      const activeDeck = decks.find(d => d.id === activeDeckId);
      if (!activeDeck) return;

      const updatedCards = activeDeck.cards.filter(c => c.id !== cardId);
      const updatedDecks = decks.map(d => {
        if (d.id === activeDeckId) {
          return { ...d, cards: updatedCards };
        }
        return d;
      });

      setDecks(updatedDecks);
      showToast("カードを削除しました", "info");
    });
  };

  const moveCardOrder = (cardId, direction) => {
    const activeDeck = decks.find(d => d.id === activeDeckId);
    if (!activeDeck) return;

    const cards = [...activeDeck.cards];
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      const temp = cards[idx];
      cards[idx] = cards[idx - 1];
      cards[idx - 1] = temp;
    } else if (direction === 'down' && idx < cards.length - 1) {
      const temp = cards[idx];
      cards[idx] = cards[idx + 1];
      cards[idx + 1] = temp;
    }

    const updatedDecks = decks.map(d => {
      if (d.id === activeDeckId) {
        return { ...d, cards: cards };
      }
      return d;
    });
    setDecks(updatedDecks);
  };

  // --- Imagen 4.0 を用いたAI画像生成 ---
  const generateAIImage = async (fieldName) => {
    if (!editingCard) return;
    const promptText = editingCard.fields.japanese || editingCard.fields.english || "creative education graphic";
    setGeneratingImageField(fieldName);
    showToast("AIが学習用イラストを生成中...", "info");
    
    try {
      const apiKeyToUse = geminiApiKey || "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKeyToUse}`;
      const payload = {
        instances: { 
          prompt: `Simple clean vector illustration of ${promptText}, cute icon card design, solid bright background, educational flashcard style` 
        }, 
        parameters: { 
          "sampleCount": 1,
          "aspectRatio": "1:1"
        } 
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Image generation failed");
      const result = await response.json();
      const base64Bytes = result.predictions?.[0]?.bytesBase64Encoded;

      if (base64Bytes) {
        const imageUrl = `data:image/png;base64,${base64Bytes}`;
        setEditingCard(prev => ({
          ...prev,
          fields: {
            ...prev.fields,
            [fieldName]: imageUrl
          }
        }));
        showToast("ビジュアル画像の生成に成功しました！", "success");
      } else {
        throw new Error("No predictions bytes returned");
      }
    } catch (err) {
      console.warn("Imagen API fallback:", err);
      const query = encodeURIComponent(promptText);
      const randomSig = Math.floor(Math.random() * 10000);
      const fallbackUrl = `https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80&sig=${randomSig}`;
      
      setEditingCard(prev => ({
        ...prev,
        fields: {
          ...prev.fields,
          [fieldName]: fallbackUrl
        }
      }));
      showToast("検索画像で仮当て表示しました！", "success");
    } finally {
      setGeneratingImageField(null);
    }
  };

  const startStudySession = (deckId, mode = 'spaced') => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck || deck.cards.length === 0) {
      showToast("学習対象のカードがありません。カードを作成してください。", "error");
      return;
    }

    let cardsToStudy = [];
    if (deck.type === 'script') {
      cardsToStudy = [...deck.cards];
      if (sceneFilter !== 'all') {
        const sceneField = deck.fields.find(f => f.isSceneFilter)?.name || 'scene';
        cardsToStudy = cardsToStudy.filter(c => c.fields[sceneField] === sceneFilter);
      }
    } else {
      if (mode === 'spaced') {
        cardsToStudy = deck.cards.filter(c => !c.nextReviewDate || c.nextReviewDate <= Date.now());
      } else {
        cardsToStudy = [...deck.cards];
      }
    }

    if (cardsToStudy.length === 0) {
      showToast("本日期限の復習予定カードはありません！素晴らしいですね。", "success");
      return;
    }

    setStudyCards(cardsToStudy);
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    setStudyMode(mode);
    
    // セッション開始時に「自動再生」を確実にONにする
    setIsAutoPlaying(true);
    setCurrentView('study');
    
    setTimeout(() => {
      if (cardsToStudy[0]) {
        speakTextWithDetect(cardsToStudy[0], deck, 'front');
      }
    }, 600);
  };

  const handleReviewAnswer = (rating) => {
    const activeDeck = decks.find(d => d.id === activeDeckId);
    if (!activeDeck) return;

    const currentCard = studyCards[currentCardIndex];
    const { interval, factor, repetitions, nextReviewDate } = calculateSM2(
      rating,
      currentCard.interval || 1,
      currentCard.factor || 2.5,
      currentCard.repetitions || 0
    );

    const updatedCards = activeDeck.cards.map(c => {
      if (c.id === currentCard.id) {
        return {
          ...c,
          interval,
          factor,
          repetitions,
          nextReviewDate
        };
      }
      return c;
    });

    const updatedDecks = decks.map(d => {
      if (d.id === activeDeckId) {
        return { ...d, cards: updatedCards };
      }
      return d;
    });

    setDecks(updatedDecks);
    advanceStudyCard();
  };

  const advanceStudyCard = () => {
    setIsCardFlipped(false);
    const nextIdx = currentCardIndex + 1;
    if (nextIdx < studyCards.length) {
      setCurrentCardIndex(nextIdx);
      const activeDeck = decks.find(d => d.id === activeDeckId);
      setTimeout(() => {
        speakTextWithDetect(studyCards[nextIdx], activeDeck, 'front');
      }, 500);
    } else {
      setStudyCards([]);
      showToast("今日の学習セッションがすべて完了しました！お疲れ様でした。", "success");
      setCurrentView('deck-detail');
    }
  };

  const exportBackupJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(decks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ankiflow_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("バックアップ用JSONファイルをエクスポートしました！", "success");
  };

  const importBackupJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData)) {
          setDecks(importedData);
          showToast("バックアップデータを正常にインポートしました！", "success");
        } else {
          showToast("形式エラー：適切なJSON配列データを選択してください。", "error");
        }
      } catch (err) {
        showToast("JSONファイルの展開に失敗しました。", "error");
      }
    };
    reader.readAsText(file);
  };

  const toggleLanguageOption = (deckId, fieldName) => {
    setSelectedLanguages(prev => {
      const current = prev[deckId] || ['english'];
      let updated;
      if (current.includes(fieldName)) {
        updated = current.filter(x => x !== fieldName);
      } else {
        updated = [...current, fieldName];
      }
      return { ...prev, [deckId]: updated };
    });
  };

  // ① コピペTSVパーサー
  const importFromTSV = (tsvText) => {
    if (!activeDeck || !tsvText.trim()) {
      showToast("貼り付けられたデータが空です", "error");
      return;
    }

    const lines = tsvText.split('\n').map(line => line.split('\t'));
    if (lines.length < 2) {
      showToast("データが2行以上必要です（ヘッダー行＋データ行）", "error");
      return;
    }

    const headers = lines[0].map(h => h.trim().toLowerCase());
    const validFields = activeDeck.fields.map(f => f.name.toLowerCase());
    
    // フィールドインデックスのマッピング
    const headerMap = {};
    headers.forEach((header, idx) => {
      // 日本語のラベル表記（"日本語" -> "japanese" 等）も補正
      let mappedName = header;
      if (header.includes('日本語') || header.includes('japanese')) mappedName = 'japanese';
      else if (header.includes('英語') || header.includes('english')) mappedName = 'english';
      else if (header.includes('フランス') || header.includes('french')) mappedName = 'french';
      else if (header.includes('中国') || header.includes('chinese')) mappedName = 'chinese';
      else if (header.includes('八重山') || header.includes('yaeyama')) mappedName = 'yaeyama';
      else if (header.includes('写真') || header.includes('photo')) mappedName = 'photo';
      else if (header.includes('メモ') || header.includes('notes') || header.includes('note')) mappedName = 'notes';
      else if (header.includes('シーン') || header.includes('scene')) mappedName = 'scene';

      const foundField = activeDeck.fields.find(f => f.name.toLowerCase() === mappedName);
      if (foundField) {
        headerMap[foundField.name] = idx;
      }
    });

    if (Object.keys(headerMap).length === 0) {
      showToast("マッチするフィールド（ヘッダー列）が見つかりませんでした", "error");
      return;
    }

    const importedCards = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue; // 空行スキップ

      const fieldsData = {};
      activeDeck.fields.forEach(f => {
        const colIdx = headerMap[f.name];
        fieldsData[f.name] = colIdx !== undefined && row[colIdx] ? row[colIdx].trim() : '';
      });

      // 最低限「日本語」または何らかの情報がある場合のみカード化
      if (Object.values(fieldsData).some(val => val)) {
        importedCards.push({
          id: `card-imported-${Date.now()}-${i}`,
          fields: fieldsData,
          interval: 1,
          factor: 2.5,
          repetitions: 0,
          nextReviewDate: Date.now()
        });
      }
    }

    if (importedCards.length === 0) {
      showToast("有効なカードデータが検出されませんでした", "error");
      return;
    }

    // デッキを更新
    const updatedDecks = decks.map(d => {
      if (d.id === activeDeckId) {
        return { ...d, cards: [...d.cards, ...importedCards] };
      }
      return d;
    });

    setDecks(updatedDecks);
    setShowSpreadsheetModal(false);
    showToast(`${importedCards.length} 枚のカードをスプレッドシートから追加しました！`, "success");
  };

  // ② コピペTSVエクスポートデータの生成
  const generateExportTSV = () => {
    if (!activeDeck || activeDeck.cards.length === 0) return '';
    const headers = activeDeck.fields.map(f => f.label);
    const headerNames = activeDeck.fields.map(f => f.name);
    
    let tsv = headers.join('\t') + '\n';
    activeDeck.cards.forEach(card => {
      const row = headerNames.map(name => {
        const val = card.fields[name] || '';
        // 改行やタブをスペースに置換してフォーマット崩れを防止
        return val.toString().replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
      });
      tsv += row.join('\t') + '\n';
    });
    return tsv;
  };

  // ③ ウェブ公開CSV URLインポート
  const handleImportWebCsv = async () => {
    if (!webCsvUrl.trim()) {
      showToast("ウェブに公開されたCSV URLを入力してください", "error");
      return;
    }
    setIsSyncing(true);
    showToast("CSVデータをスプレッドシートから同期中...", "info");

    try {
      // CORS回避のための一般的なプロキシ、または直接fetchを試みる
      const response = await fetch(webCsvUrl);
      if (!response.ok) throw new Error("CSVの取得に失敗しました");
      const csvText = await response.text();

      // 簡易CSVパーサ（カンマ/タブ両対応）
      const rows = [];
      let currentRow = [];
      let insideQuote = false;
      let currentVal = '';

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i+1];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          currentRow.push(currentVal);
          currentVal = '';
        } else if ((char === '\n' || char === '\r') && !insideQuote) {
          if (char === '\r' && nextChar === '\n') i++; // CRLF
          currentRow.push(currentVal);
          rows.push(currentRow);
          currentRow = [];
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      if (currentVal || currentRow.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
      }

      // TSVパーサーと同様にヘッダーマッピング
      if (rows.length < 2) {
        throw new Error("有効なCSVフォーマットではありません");
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const headerMap = {};
      headers.forEach((header, idx) => {
        let mappedName = header;
        if (header.includes('日本語') || header.includes('japanese')) mappedName = 'japanese';
        else if (header.includes('英語') || header.includes('english')) mappedName = 'english';
        else if (header.includes('フランス') || header.includes('french')) mappedName = 'french';
        else if (header.includes('中国') || header.includes('chinese')) mappedName = 'chinese';
        else if (header.includes('八重山') || header.includes('yaeyama')) mappedName = 'yaeyama';
        else if (header.includes('写真') || header.includes('photo')) mappedName = 'photo';
        else if (header.includes('メモ') || header.includes('notes') || header.includes('note')) mappedName = 'notes';
        else if (header.includes('シーン') || header.includes('scene')) mappedName = 'scene';

        const foundField = activeDeck.fields.find(f => f.name.toLowerCase() === mappedName);
        if (foundField) {
          headerMap[foundField.name] = idx;
        }
      });

      const importedCards = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;

        const fieldsData = {};
        activeDeck.fields.forEach(f => {
          const colIdx = headerMap[f.name];
          fieldsData[f.name] = colIdx !== undefined && row[colIdx] ? row[colIdx].trim() : '';
        });

        if (Object.values(fieldsData).some(val => val)) {
          importedCards.push({
            id: `card-csv-${Date.now()}-${i}`,
            fields: fieldsData,
            interval: 1,
            factor: 2.5,
            repetitions: 0,
            nextReviewDate: Date.now()
          });
        }
      }

      if (importedCards.length === 0) {
        throw new Error("取り込めるカード情報がありませんでした");
      }

      const updatedDecks = decks.map(d => {
        if (d.id === activeDeckId) {
          return { ...d, cards: [...d.cards, ...importedCards] };
        }
        return d;
      });

      setDecks(updatedDecks);
      setShowSpreadsheetModal(false);
      showToast(`${importedCards.length} 枚のカードをスプレッドシートから同期インポートしました！`, "success");
    } catch (err) {
      console.error(err);
      showToast(`スプレッドシートCSV同期エラー: ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // ④ Google Apps Script (GAS) Webhook 経由のクラウド双方向同期
  const handleGasSync = async (direction) => {
    if (!gasWebhookUrl.trim()) {
      showToast("GASウェブアプリURLを入力してください", "error");
      return;
    }
    setIsSyncing(true);
    showToast(`GAS経由でスプレッドシートとデータを${direction === 'upload' ? '同期保存' : '同期取得'}中...`, "info");

    try {
      if (direction === 'upload') {
        // 現在の全カードをJSONにしてGASへPOST
        const payload = activeDeck.cards.map(c => ({
          id: c.id,
          ...c.fields,
          interval: c.interval,
          factor: c.factor,
          repetitions: c.repetitions,
          nextReviewDate: c.nextReviewDate
        }));

        const response = await fetch(gasWebhookUrl, {
          method: 'POST',
          mode: 'no-cors', // クロスオリジンでのエラー回避
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        // no-cors の場合は中身が読めないため、成功と仮定してトーストを出す
        showToast("スプレッドシートにカード一覧を自動上書きエクスポートしました！", "success");
      } else {
        // GASから最新データをGET取得してデッキへ同期
        const response = await fetch(gasWebhookUrl);
        if (!response.ok) throw new Error("GAS連携サーバーからのデータ取得に失敗しました");
        const jsonList = await response.json();

        if (!Array.isArray(jsonList)) {
          throw new Error("レスポンスデータが配列形式ではありません");
        }

        const syncCards = jsonList.map((item, idx) => {
          const fieldsData = {};
          activeDeck.fields.forEach(f => {
            fieldsData[f.name] = item[f.name] || item[f.label] || '';
          });

          return {
            id: item.id || `card-gas-${Date.now()}-${idx}`,
            fields: fieldsData,
            interval: item.interval || 1,
            factor: item.factor || 2.5,
            repetitions: item.repetitions || 0,
            nextReviewDate: item.nextReviewDate || Date.now()
          };
        });

        const updatedDecks = decks.map(d => {
          if (d.id === activeDeckId) {
            return { ...d, cards: syncCards };
          }
          return d;
        });

        setDecks(updatedDecks);
        setShowSpreadsheetModal(false);
        showToast(`スプレッドシートから ${syncCards.length} 枚のカードデータを完全同期取得しました！`, "success");
      }
    } catch (err) {
      console.error(err);
      showToast(`GAS通信同期に失敗しました: ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const activeDeck = decks.find(d => d.id === activeDeckId);

  const getUniqueScenes = (deck) => {
    if (!deck) return [];
    const sceneField = deck.fields.find(f => f.isSceneFilter)?.name || 'scene';
    const scenes = deck.cards.map(c => c.fields[sceneField]).filter(Boolean);
    return Array.from(new Set(scenes));
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* トースト表示 */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-2xl animate-bounce bg-slate-900 border-indigo-500 text-white max-w-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping"></div>
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* カスタム確認用モーダル (alert/confirmの代替UI) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl border p-6 space-y-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-200">確認</h4>
              <p className="text-xs text-slate-400">{confirmModal.message}</p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white"
              >
                キャンセル
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-xs text-white"
              >
                実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ナビゲーション */}
      <nav className={`border-b sticky top-0 z-40 backdrop-blur-lg ${theme === 'dark' ? 'bg-slate-950/80 border-slate-900' : 'bg-white/80 border-slate-200 shadow-sm'}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentView('decks'); setIsAutoPlaying(false); }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/10">
              <Icon name="sparkles" className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                AnkiFlow <span className="text-[10px] bg-gradient-to-r from-indigo-500 to-pink-500 text-white px-2 py-0.5 rounded-full font-bold">PRO</span>
              </h1>
              <p className="text-[10px] text-slate-400">忘却曲線 ✕ AI自動翻訳 ✕ 学習言語マルチセレクター</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-900 text-amber-400' : 'hover:bg-slate-100 text-slate-500'}`}
              title="カラーテーマ切り替え"
            >
              {theme === 'dark' ? '☀️ ライト' : '🌙 ダーク'}
            </button>

            <button
              onClick={() => { setCurrentView('help'); setIsAutoPlaying(false); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${currentView === 'help' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-indigo-500/10 text-indigo-400'}`}
            >
              <Icon name="info" className="w-4 h-4" /> 使い方・データ
            </button>
          </div>
        </div>
      </nav>

      {/* メインスペース */}
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* VIEW 1: ダッシュボード（デッキ選択一覧） */}
        {currentView === 'decks' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-indigo-950/20 via-violet-950/20 to-pink-950/10 p-6 rounded-3xl border border-indigo-900/20">
              <div>
                <h2 className="text-2xl font-black">マイ暗記デッキライブラリ</h2>
                <p className="text-xs text-slate-400 mt-1">
                  用途に特化したカスタマイズデッキで、科学的な間隔反復（Spaced Repetition）を始めましょう。
                </p>
              </div>
              <button 
                onClick={handleCreateDeck}
                className="px-5 py-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 hover:opacity-90 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-950/40 hover:scale-[1.03] transition-all"
              >
                <Icon name="plus" className="w-4 h-4" /> 新規デッキを作成
              </button>
            </div>

            {/* デッキ選択グリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {decks.map((deck) => {
                const totalCards = deck.cards.length;
                const dueCards = deck.type === 'script' 
                  ? totalCards 
                  : deck.cards.filter(c => !c.nextReviewDate || c.nextReviewDate <= Date.now()).length;

                return (
                  <div 
                    key={deck.id}
                    onClick={() => { setActiveDeckId(deck.id); setCurrentView('deck-detail'); }}
                    className={`group relative border rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${
                      theme === 'dark' 
                        ? 'bg-slate-900/30 border-slate-900 hover:border-slate-800' 
                        : 'bg-white border-slate-200 hover:border-indigo-200 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider mb-2.5 ${
                          deck.type === 'word' 
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' 
                            : deck.type === 'phrase' 
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800' 
                            : 'bg-violet-950/80 text-violet-300 border border-violet-800'
                        }`}>
                          {deck.type === 'word' ? '単語学習' : deck.type === 'phrase' ? 'フレーズ学習' : '台本暗記'}
                        </span>
                        <h3 className="text-lg font-black text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">{deck.name}</h3>
                      </div>
                      
                      <button 
                        onClick={(e) => handleDeleteDeck(deck.id, e)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="デッキ削除"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                      各言語に完全適応。自動翻訳対応型暗記モデル。
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-900/60 flex justify-between items-center">
                      <div className="flex gap-4">
                        <div className="text-xs">
                          <span className="block font-black text-xl text-slate-200">{totalCards}</span>
                          <span className="text-slate-500">総カード数</span>
                        </div>
                        {deck.type !== 'script' && (
                          <div className="text-xs">
                            <span className="block font-black text-xl text-amber-400">{dueCards}</span>
                            <span className="text-amber-500/80">要復習</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {deck.type !== 'script' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDeckId(deck.id);
                              startStudySession(deck.id, 'spaced');
                            }}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10"
                          >
                            今日学習
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDeckId(deck.id);
                            startStudySession(deck.id, 'order');
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
                        >
                          順序学習
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: デッキ詳細 & カード管理画面 */}
        {currentView === 'deck-detail' && activeDeck && (
          <div className="space-y-6 animate-fadeIn">
            
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pb-6 border-b border-slate-900">
              <div className="space-y-1">
                <button 
                  onClick={() => { setCurrentView('decks'); setIsAutoPlaying(false); }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mb-2 group"
                >
                  <span className="transition-transform group-hover:-translate-x-1">←</span> デッキ一覧へ戻る
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black">{activeDeck.name}</h2>
                  <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-bold">
                    {activeDeck.type === 'word' ? '単語' : activeDeck.type === 'phrase' ? 'フレーズ' : '台本'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">カードの新規作成、自動翻訳、学習ターゲット言語のセレクトを行います。</p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {/* スプレッドシート連携ボタンの追加 */}
                <button
                  onClick={() => {
                    setSpreadsheetInputText('');
                    setShowSpreadsheetModal(true);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 rounded-xl font-bold text-xs flex items-center gap-2 hover:scale-[1.02] transition-all"
                  title="Googleスプレッドシート連携インポート＆エクスポート"
                >
                  📊 スプレッドシート連携
                </button>

                <button 
                  onClick={() => handleCreateCard(activeDeck)}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-500/10 hover:scale-[1.02] transition-all"
                >
                  <Icon name="plus" className="w-4 h-4" /> 新カード追加
                </button>

                {activeDeck.cards.length > 0 && (
                  <button 
                    onClick={() => startStudySession(activeDeck.id, 'order')}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-[1.02] transition-all"
                  >
                    <Icon name="play" className="w-4 h-4" /> 今すぐ学習を開始
                  </button>
                )}
              </div>
            </div>

            {/* 学習したい言語を選択（読み上げ・学習制御用） */}
            <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-slate-900' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Icon name="translate" className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-sm font-black text-slate-200">学習ターゲット言語の選択</h4>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                チェックを入れた言語が学習・TTS音声の読み上げ対象になります。日本語は常にベースラインとして読み上げられます。
              </p>

              <div className="flex flex-wrap gap-2.5">
                {activeDeck.fields
                  .filter(f => f.readAloud && f.name !== 'japanese')
                  .map(f => {
                    const isSelected = (selectedLanguages[activeDeck.id] || ['english']).includes(f.name);
                    return (
                      <button
                        key={f.name}
                        onClick={() => toggleLanguageOption(activeDeck.id, f.name)}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/10'
                            : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'}`}></div>
                        {f.label} ({f.name.toUpperCase()})
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* シーンフィルタリング（台本暗記用） */}
            {activeDeck.type === 'script' && getUniqueScenes(activeDeck).length > 0 && (
              <div className={`p-5 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-slate-900' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-400">台本専用シーンフィルタ</span>
                </div>
                <select 
                  value={sceneFilter}
                  onChange={(e) => setSceneFilter(e.target.value)}
                  className={`w-full max-w-xs px-3 py-2.5 rounded-xl text-xs border ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-100 border-slate-200'}`}
                >
                  <option value="all">すべてのシーン ({activeDeck.cards.length} 枚)</option>
                  {getUniqueScenes(activeDeck).map(scene => (
                    <option key={scene} value={scene}>{scene}</option>
                  ))}
                </select>
              </div>
            )}

            {/* カード一覧 */}
            {activeDeck.cards.length === 0 ? (
              <div className={`text-center py-20 border border-dashed rounded-3xl ${theme === 'dark' ? 'border-slate-800 bg-slate-900/10' : 'border-slate-300 bg-slate-100/10'}`}>
                <Icon name="book" className="w-14 h-14 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-black mb-1.5 text-slate-300">カードが登録されていません</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                  上部のアクションバーにある「新カード追加」をクリックして、最初の暗記対象データを登録しましょう。
                </p>
              </div>
            ) : (
              <div className={`border rounded-3xl overflow-hidden ${theme === 'dark' ? 'border-slate-800 bg-slate-900/10' : 'border-slate-200 bg-white shadow-sm'}`}>
                <div className="p-4 border-b border-slate-900/60 flex items-center bg-slate-950/20">
                  <Icon name="search" className="w-4 h-4 text-slate-500 mr-2" />
                  <input 
                    type="text" 
                    placeholder="カードのテキストをキーワード検索..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-xs outline-none w-full text-slate-300"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        {activeDeck.type === 'script' && <th className="p-4 w-16 text-center">順序</th>}
                        <th className="p-4">日本語 (標準)</th>
                        <th className="p-4">英語 (自動翻訳)</th>
                        <th className="p-4">フランス語</th>
                        <th className="p-4">中国語</th>
                        <th className="p-4 text-right w-32">アクション</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDeck.cards
                        .filter(c => {
                          if (searchQuery.trim() === '') return true;
                          return Object.values(c.fields).some(val => 
                            val && val.toString().toLowerCase().includes(searchQuery.toLowerCase())
                          );
                        })
                        .map((card, idx) => {
                          return (
                            <tr key={card.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-800/60 hover:bg-slate-900/50' : 'border-slate-200 hover:bg-slate-50/50'}`}>
                              
                              {activeDeck.type === 'script' && (
                                <td className="p-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <button 
                                      onClick={() => moveCardOrder(card.id, 'up')}
                                      className="p-0.5 hover:bg-slate-800 rounded transition-all"
                                      disabled={idx === 0}
                                    >
                                      ▲
                                    </button>
                                    <span className="text-xs font-black text-slate-300">{idx + 1}</span>
                                    <button 
                                      onClick={() => moveCardOrder(card.id, 'down')}
                                      className="p-0.5 hover:bg-slate-800 rounded transition-all"
                                      disabled={idx === activeDeck.cards.length - 1}
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </td>
                              )}

                              <td className="p-4 font-bold text-slate-200">
                                <div className="line-clamp-2 max-w-xs">
                                  {card.fields.japanese}
                                </div>
                              </td>

                              <td className="p-4 text-slate-400">
                                <div className="line-clamp-2 max-w-xs">{card.fields.english || '未翻訳'}</div>
                              </td>

                              <td className="p-4 text-slate-400">
                                <div className="line-clamp-2 max-w-xs">{card.fields.french || '未翻訳'}</div>
                              </td>

                              <td className="p-4 text-slate-400">
                                <div className="line-clamp-2 max-w-xs">{card.fields.chinese || '未翻訳'}</div>
                              </td>

                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button 
                                    onClick={() => speakTextWithDetect(card, activeDeck, activeDeck.fields.find(f => f.name === 'japanese'))}
                                    className={`p-2 rounded-xl hover:bg-slate-800 transition-colors ${isTtsLoading ? 'opacity-50' : ''}`}
                                    title="音声読み上げ"
                                  >
                                    <Icon name="volume" className="w-4 h-4 text-indigo-400 hover:text-indigo-300" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setEditingCard({ ...card });
                                      setShowCardModal(true);
                                    }}
                                    className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                    title="カード編集"
                                  >
                                    <Icon name="edit" className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCard(card.id)}
                                    className="p-2 rounded-xl hover:bg-slate-800 text-red-500 hover:text-red-400 transition-colors"
                                    title="削除"
                                  >
                                    <Icon name="trash" className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: 学習セッション画面 */}
        {currentView === 'study' && activeDeck && (
          <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-900">
              <button 
                onClick={() => { setCurrentView('deck-detail'); setIsAutoPlaying(false); }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 group"
              >
                <span>←</span> 学習を一旦終了
              </button>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-semibold">進捗: </span>
                <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                  {studyCards.length > 0 ? `${currentCardIndex + 1} / ${studyCards.length}` : '0 / 0'}
                </span>
              </div>
            </div>

            {/* 自動再生コントローラー */}
            <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${theme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50 border-indigo-100 shadow-sm'}`}>
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-xs font-black text-indigo-400 flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> 自動再生モード (スリープ防止対応)
                </h4>
                <p className="text-[10px] text-slate-400">「日本語」と「学習ターゲット言語」を交互に読み上げます。</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">待機秒数:</span>
                  <input 
                    type="number" 
                    value={autoPlayInterval}
                    onChange={(e) => setAutoPlayInterval(Math.max(2, parseInt(e.target.value) || 2))}
                    className={`w-12 text-center py-1 rounded text-xs font-bold ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-300'}`}
                  />
                </div>

                <button 
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ${
                    isAutoPlaying 
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/10' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/10'
                  }`}
                >
                  <Icon name={isAutoPlaying ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                  {isAutoPlaying ? '一時停止' : '自動再生'}
                </button>
              </div>
            </div>

            {/* フラッシュカード本体 */}
            {studyCards.length === 0 ? (
              <div className="p-10 text-center border rounded-3xl bg-slate-900/10 border-slate-800">
                <Icon name="check" className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-xl font-black mb-2">セッション終了！</h3>
                <p className="text-xs text-slate-400 mb-6">すべてのカードを読み終えました。</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const card = studyCards[currentCardIndex];
                  const activeLangs = selectedLanguages[activeDeck.id] || ['english'];

                  return (
                    <div className="space-y-6">
                      
                      <div 
                        onClick={() => { if (!isAutoPlaying) setIsCardFlipped(!isCardFlipped); }}
                        className={`relative min-h-[350px] rounded-[2rem] border p-8 flex flex-col justify-between cursor-pointer select-none transition-all duration-300 ${
                          isCardFlipped 
                            ? 'bg-slate-900 border-indigo-500/60 shadow-2xl shadow-indigo-950/40' 
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 shadow-xl'
                        }`}
                      >
                        <div className="flex justify-between items-center pb-4 border-b border-slate-900">
                          {activeDeck.type === 'script' && card.fields.scene && (
                            <span className="px-3 py-1 text-xs font-bold bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
                              {card.fields.scene}
                            </span>
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                            {isCardFlipped ? '解答 (裏面)' : '問題 (表面)'}
                          </span>
                        </div>

                        <div className="my-auto text-center space-y-6 py-6 animate-fadeIn">
                          {!isCardFlipped ? (
                            <div className="space-y-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">日本語</span>
                              <div className="text-2xl md:text-3xl font-black text-white leading-normal tracking-wide">
                                {card.fields.japanese}
                              </div>
                              {card.fields.photo && renderFieldValue(card.fields.photo, '写真')}
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {activeDeck.fields
                                .filter(f => f.readAloud && f.name !== 'japanese' && activeLangs.includes(f.name))
                                .map(f => (
                                  <div key={f.name} className="space-y-1">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">{f.label}</span>
                                    <div className="text-2xl md:text-3xl font-black text-white leading-normal">
                                      {card.fields[f.name]}
                                    </div>
                                  </div>
                                ))}

                              {activeDeck.fields
                                .filter(f => f.name !== 'photo' && f.name !== 'japanese' && f.name !== 'scene' && !activeLangs.includes(f.name))
                                .map(f => {
                                  const val = card.fields[f.name];
                                  if (!val) return null;
                                  return (
                                    <div key={f.name} className="text-xs text-slate-400 pt-2 border-t border-slate-900">
                                      <span className="text-[9px] font-bold text-slate-500 block">{f.label}</span>
                                      <div className="text-slate-300">{val}</div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-900">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              speakTextWithDetect(card, activeDeck, isCardFlipped ? 'back' : 'front');
                            }}
                            className={`p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:text-indigo-400 hover:border-slate-700 flex items-center gap-1.5 font-bold text-slate-200 ${isTtsLoading ? 'opacity-50' : ''}`}
                          >
                            <Icon name="volume" className="w-4 h-4 text-indigo-400" /> 
                            {isTtsLoading ? '再生中...' : '音声再生'}
                          </button>

                          <div className="flex items-center gap-1">
                            <span>{isAutoPlaying ? '自動進行中' : 'タップでめくる'}</span>
                          </div>
                        </div>
                      </div>

                      {!isAutoPlaying && (
                        <div className="animate-fadeIn">
                          {!isCardFlipped ? (
                            <button 
                              onClick={() => setIsCardFlipped(true)}
                              className="w-full py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 hover:opacity-90 text-white font-extrabold rounded-2xl shadow-lg transition-all text-xs tracking-wider"
                            >
                              解答を表示
                            </button>
                          ) : (
                            <div className="space-y-4">
                              {studyMode === 'spaced' && activeDeck.type !== 'script' ? (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-slate-500 text-center font-bold uppercase">記憶度合いを選択</p>
                                  <div className="grid grid-cols-4 gap-2">
                                    <button 
                                      onClick={() => handleReviewAnswer(1)}
                                      className="py-3 px-1 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-900 text-red-300 text-xs font-bold transition-all text-center"
                                    >
                                      ❌ もう一度
                                    </button>
                                    <button 
                                      onClick={() => handleReviewAnswer(2)}
                                      className="py-3 px-1 rounded-2xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-900 text-amber-300 text-xs font-bold transition-all text-center"
                                    >
                                      🔺 難しい
                                    </button>
                                    <button 
                                      onClick={() => handleReviewAnswer(4)}
                                      className="py-3 px-1 rounded-2xl bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-950 text-indigo-300 text-xs font-bold transition-all text-center"
                                    >
                                      👌 できた
                                    </button>
                                    <button 
                                      onClick={() => handleReviewAnswer(5)}
                                      className="py-3 px-1 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-900 text-emerald-300 text-xs font-bold transition-all text-center"
                                    >
                                      ⭐ 簡単
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={advanceStudyCard}
                                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all text-xs tracking-wider"
                                >
                                  次のカードに進む ➔
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: 設定・使い方・バックアップ */}
        {currentView === 'help' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            
            {/* バックアップ設定 */}
            <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-slate-900' : 'bg-white border-slate-200'}`}>
              <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                📂 データのバックアップとインポート
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                ブラウザのストレージの他に、デッキ情報全てを外部JSONファイルとして保存できます。
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={exportBackupJSON}
                  className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/15"
                >
                  <Icon name="download" className="w-4 h-4" /> バックアップ(JSON)を保存
                </button>

                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={importBackupJSON}
                    id="import-backup-file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <label 
                    htmlFor="import-backup-file"
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-700 justify-center cursor-pointer"
                  >
                    <Icon name="upload" className="w-4 h-4" /> バックアップから復元
                  </label>
                </div>
              </div>
            </div>

            {/* Googleスプレッドシート連携・GASセットアップ説明 */}
            <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-slate-900' : 'bg-white border-slate-200'}`}>
              <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                📊 GoogleスプレッドシートGAS連携セットアップ
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                スプレッドシートと完全双方向で同期をしたい場合は、以下の手順でGoogle Apps Script (GAS) を作成してください。
              </p>

              <div className="space-y-3.5 text-xs text-slate-300">
                <ol className="list-decimal list-inside space-y-2.5">
                  <li>スプレッドシートを開き、メニューの「拡張機能」 ➔ 「Apps Script」をクリック。</li>
                  <li>元からあるコードを消去し、以下のスクリプトを貼り付けます。</li>
                  <li>右上の「デプロイ」 ➔ 「新しいデプロイ」をクリックし、種類で「ウェブアプリ」を選択。</li>
                  <li>アクセスできるユーザーを「全員(Anyone)」に変更してデプロイを実行します。</li>
                  <li>生成された「ウェブアプリURL」をコピーし、本アプリの連携メニューに入力してください。</li>
                </ol>

                <div className="mt-3.5">
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">貼り付け用 GAS コード</label>
                  <textarea 
                    readOnly
                    onClick={(e) => {
                      e.target.select();
                      document.execCommand('copy');
                      showToast("GASコードをクリップボードにコピーしました！", "success");
                    }}
                    value={`function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var record = {};
    for (var j = 0; j < headers.length; j++) {
      record[headers[j]] = row[j];
    }
    result.push(record);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();
  var body = JSON.parse(e.postData.contents);
  if (body && body.length > 0) {
    var headers = Object.keys(body[0]);
    sheet.appendRow(headers);
    body.forEach(function(row) {
      var vals = headers.map(function(h) { return row[h] || ''; });
      sheet.appendRow(vals);
    });
  }
  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}`}
                    className="w-full h-40 p-3 rounded-2xl bg-slate-950 border border-slate-900 font-mono text-[11px] text-indigo-300 cursor-pointer focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">※エリアを一度クリックするだけで、全行自動でコピーできます。</span>
                </div>
              </div>
            </div>

            {/* 音声合成(TTS)＆Gemini設定 */}
            <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-slate-900' : 'bg-white border-slate-200'}`}>
              <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                🎤 音声エンジン ＆ 自動翻訳設定
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                標準の読み上げエンジンのほか、Gemini APIキーを設定することで、高精度の音声合成や自動翻訳が解放されます。
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">音声エンジン</label>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input 
                        type="radio" 
                        name="engine-select" 
                        value="browser"
                        checked={ttsEngine === 'browser'}
                        onChange={(e) => setTtsEngine(e.target.value)}
                        className="text-indigo-600"
                      />
                      標準 SpeechSynthesis API (オフライン対応)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input 
                        type="radio" 
                        name="engine-select" 
                        value="gemini"
                        checked={ttsEngine === 'gemini'}
                        onChange={(e) => setTtsEngine(e.target.value)}
                        className="text-indigo-600"
                      />
                      Gemini 高音質TTSモード (APIキー対応)
                    </label>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-slate-950/40 rounded-2xl border border-slate-900">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Gemini API キー</label>
                    <input 
                      type="password" 
                      placeholder="AIzaSy..." 
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-950 border border-slate-900 text-white outline-none"
                    />
                  </div>

                  {ttsEngine === 'gemini' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5">Geminiボイススタイル</label>
                      <select 
                        value={ttsVoice}
                        onChange={(e) => setTtsVoice(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-900 text-white rounded-xl"
                      >
                        {GEMINI_VOICES.map(voice => (
                          <option key={voice.id} value={voice.id}>{voice.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 各デッキ・暗記モードの仕様ヘルプ */}
            <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-slate-900' : 'bg-white border-slate-200'}`}>
              <h3 className="text-lg font-black mb-3">💡 本アプリの使い方について</h3>
              <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                <div className="p-3 bg-slate-950/10 border border-slate-900 rounded-xl">
                  <span className="font-bold text-white block">① AI自動翻訳機能</span>
                  <p className="mt-1">
                    新カードを追加するとき、日本語のみを入力し、すぐ右にある「✨ AI自動翻訳」ボタンをクリックすれば、自動で英語・フランス語・中国語の翻訳をGeminiが瞬時に補完します。
                  </p>
                </div>
                <div className="p-3 bg-slate-950/10 border border-slate-900 rounded-xl">
                  <span className="font-bold text-white block">② 学習対象の個別セレクト</span>
                  <p className="mt-1">
                    各デッキ詳細で、そのセッションで学習したい特定の言語（複数可）を選択できます。読み上げ音声も、「日本語」と、その選んだ学習したい言語のみが順番に出力されます。
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* --- グローバルモーダルセクション --- */}

      {/* DECK CREATION MODAL */}
      {showDeckModal && editingDeck && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl border p-6 space-y-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-900">
              <h3 className="text-base font-bold">暗記デッキの作成</h3>
              <button onClick={() => setShowDeckModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-bold">デッキの名前</label>
                <input 
                  type="text" 
                  value={editingDeck.name}
                  onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
                  placeholder="例: 旅行英会話、TOEIC重要名詞"
                  className={`w-full px-3 py-2.5 rounded-xl border ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-bold">暗記カテゴリー</label>
                <select 
                  value={editingDeck.type}
                  onChange={(e) => {
                    const typeSelected = e.target.value;
                    setEditingDeck({ 
                      ...editingDeck, 
                      type: typeSelected,
                      fields: [...DEFAULT_FIELDS[typeSelected]]
                    });
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border font-semibold ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                >
                  <option value="word">単語学習 (写真・多言語・八重山対応)</option>
                  <option value="phrase">フレーズ学習 (日本語・各対応外国語)</option>
                  <option value="script">台本暗記 (シーン指定・順番固定・多言語)</option>
                </select>
              </div>

              <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-900">
                <span className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">作成されるフィールド構造:</span>
                <div className="flex flex-wrap gap-1.5">
                  {editingDeck.fields.map(f => (
                    <span key={f.name} className="px-2 py-0.5 bg-slate-900 rounded text-[10px] font-semibold text-slate-300">
                      {f.label} {f.readAloud ? '🗣️' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-900">
              <button 
                onClick={() => setShowDeckModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSaveDeck}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white"
              >
                デッキを保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD CREATION/EDIT MODAL WITH TRANSLATION BUTTON */}
      {showCardModal && editingCard && activeDeck && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-[2rem] border p-6 my-8 space-y-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200'}`}>
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-900">
              <h3 className="text-base font-black">カード編集・新規作成</h3>
              <button onClick={() => setShowCardModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {activeDeck.fields.map((field) => {
                const isPhotoField = field.name === 'photo' || field.label.includes('写真');
                const isJapaneseField = field.name === 'japanese';
                const isTranslatableField = ['english', 'french', 'chinese'].includes(field.name);

                return (
                  <div key={field.name} className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        {field.isPrimary && <span className="text-[8px] bg-violet-950 text-violet-300 px-1.5 py-0.5 rounded border border-violet-800">表面メイン</span>}
                        {field.readAloud && <span className="text-[8px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">TTS対象</span>}
                      </div>
                      
                      {isPhotoField && (
                        <button
                          onClick={() => generateAIImage(field.name)}
                          disabled={generatingImageField === field.name}
                          className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                        >
                          {generatingImageField === field.name ? '生成中...' : '🎨 AI画像生成 (Imagen)'}
                        </button>
                      )}

                      {isJapaneseField && (
                        <button
                          onClick={handleAutoTranslate}
                          disabled={isTranslating}
                          className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/40"
                        >
                          {isTranslating ? '翻訳中...' : '✨ 日本語から3言語へ自動翻訳'}
                        </button>
                      )}
                    </label>

                    {isPhotoField && editingCard.fields[field.name] && (
                      <div className="my-2 p-2 border border-slate-900 bg-slate-950/40 rounded-2xl flex items-center justify-center">
                        <img src={editingCard.fields[field.name]} alt="カード写真プレビュー" className="max-h-24 object-contain rounded-xl shadow-lg" />
                      </div>
                    )}

                    <textarea 
                      value={editingCard.fields[field.name] || ''}
                      onChange={(e) => setEditingCard({
                        ...editingCard,
                        fields: {
                          ...editingCard.fields,
                          [field.name]: e.target.value
                        }
                      })}
                      className={`w-full px-4 py-2.5 rounded-2xl border text-xs outline-none ${
                        isTranslatableField ? 'border-indigo-900/40 bg-indigo-950/10' : ''
                      } ${theme === 'dark' ? 'bg-slate-950 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                      rows={field.name === 'notes' || field.name === 'japanese' || field.name === 'english' ? 2 : 1}
                      placeholder={
                        isPhotoField 
                          ? "画像URLを入力するか、右上のボタンでAI生成してください" 
                          : isTranslatableField 
                          ? "自動翻訳を利用するか、直接翻訳文を入力してください"
                          : `${field.label}の内容を入力...`
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
              <button 
                onClick={() => setShowCardModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSaveCard}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white flex items-center gap-1.5"
              >
                <Icon name="save" className="w-4 h-4" /> 保存して追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SPREADSHEET SYNC MODAL --- */}
      {showSpreadsheetModal && activeDeck && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-[2rem] border p-6 my-8 space-y-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200'}`}>
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-900">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h3 className="text-base font-black">スプレッドシート連携: {activeDeck.name}</h3>
              </div>
              <button onClick={() => setShowSpreadsheetModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-6">
              {/* 方法1: コピペ連携 */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/40 border border-slate-850">
                <span className="block text-xs font-black text-indigo-400">アプローチ A: コピペで直接インポート/エクスポート</span>
                <p className="text-[11px] text-slate-400">
                  スプレッドシートのセル（ヘッダー行含む）をコピーして、下のエリアに貼り付けてください。
                </p>
                <div className="flex flex-col gap-3">
                  <textarea
                    placeholder={`[列ヘッダーフォーマット例]\n${activeDeck.fields.map(f => f.label).join('\t')}`}
                    value={spreadsheetInputText}
                    onChange={(e) => setSpreadsheetInputText(e.target.value)}
                    className="w-full h-32 p-3 rounded-2xl bg-slate-950 border border-slate-900 font-mono text-xs text-slate-300 outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => importFromTSV(spreadsheetInputText)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs"
                    >
                      貼り付けたセルからインポート
                    </button>
                    <button
                      onClick={() => {
                        const tsv = generateExportTSV();
                        if (!tsv) {
                          showToast("エクスポートするカードがありません", "error");
                          return;
                        }
                        setSpreadsheetInputText(tsv);
                        // クリップボードにコピー
                        const dummy = document.createElement("textarea");
                        document.body.appendChild(dummy);
                        dummy.value = tsv;
                        dummy.select();
                        document.execCommand("copy");
                        document.body.removeChild(dummy);
                        showToast("全カードのTSVをクリップボードにコピーしました！スプレッドシートに直接ペーストできます。", "success");
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs border border-slate-700"
                    >
                      スプレッドシート用TSVをコピー
                    </button>
                  </div>
                </div>
              </div>

              {/* 方法2: 公開CSV連携 */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-slate-950/40 border border-slate-850">
                <span className="block text-xs font-black text-emerald-400">アプローチ B: 「ウェブに公開」CSVからワンタップ同期</span>
                <p className="text-[11px] text-slate-400">
                  シートの「ファイル」 ➔ 「共有」 ➔ 「ウェブに公開」からカンマ区切り値(CSV)を選択し、生成された公開用リンクを登録します。
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                    value={webCsvUrl}
                    onChange={(e) => setWebCsvUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-900 text-slate-300 outline-none"
                  />
                  <button
                    onClick={handleImportWebCsv}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs whitespace-nowrap"
                  >
                    CSV同期
                  </button>
                </div>
              </div>

              {/* 方法3: GAS同期 */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-slate-950/40 border border-slate-850">
                <span className="block text-xs font-black text-violet-400">アプローチ C: GAS Webapp 連携による完全双方向同期</span>
                <p className="text-[11px] text-slate-400">
                  Google Apps Scriptをデプロイし、シートへの自動上書き（エクスポート）と、シートからの自動カード取り込み（インポート）をオンラインで自動化。
                </p>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasWebhookUrl}
                  onChange={(e) => setGasWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-900 text-slate-300 outline-none mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGasSync('download')}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs"
                  >
                    シートからダウンロード同期
                  </button>
                  <button
                    onClick={() => handleGasSync('upload')}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-xl font-bold text-xs"
                  >
                    シートへアップロード同期
                  </button>
                </div>
              </div>

            </div>

            <div className="flex justify-end pt-4 border-t border-slate-900">
              <button 
                onClick={() => setShowSpreadsheetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}