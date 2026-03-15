export const normalizeArabic = (str: string): string => {
    if (!str) return '';
    return str.trim()
        .replace(/\s+/g, ' ')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[ـ\u064B-\u0652]/g, '')
        .toLowerCase();
};

export const isFuzzyMatch = (guess: string, word: string): boolean => {
    const nGuess = normalizeArabic(guess);
    const nWord = normalizeArabic(word);
    
    return nGuess === nWord || 
           (nGuess.length >= 3 && nWord.includes(nGuess)) ||
           (nWord.length >= 3 && nGuess.includes(nWord));
};
