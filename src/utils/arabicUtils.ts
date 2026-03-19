export const normalizeArabic = (str: string): string => {
    if (!str) return '';
    return str.trim()
        .replace(/\s+/g, ' ')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[ـ\u064B-\u0652]/g, '')
        .replace(/\uFEFB|\uFEFC|\uFEF9|\uFEFA/g, 'لا') // Normalize Lam-Alif ligatures
        .toLowerCase();
};

export const isFuzzyMatch = (guess: string, word: string): boolean => {
    const nGuess = normalizeArabic(guess);
    const nWord = normalizeArabic(word);
    return nGuess === nWord;
};
