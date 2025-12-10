function getFontColorForBackground(backgroundColor) {
    const rgb = getRgbFromCssColor(backgroundColor);
    if (!rgb) return '#000000'; // Default to black

    // Formula to determine brightness (luminance)
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    return luminance > 0.5 ? '#000000' : '#FFFFFF'; // Dark text on light bg, light text on dark bg
}

function getRgbFromCssColor(cssColor) {
    if (cssColor.startsWith('rgb')) {
        const matches = cssColor.match(/(\d+)/g);
        if (matches && matches.length >= 3) {
            return { r: parseInt(matches[0]), g: parseInt(matches[1]), b: parseInt(matches[2]) };
        }
    } else if (cssColor.startsWith('#')) {
        const hex = cssColor.replace('#', '');
        const bigint = parseInt(hex, 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }
    // This function doesn't handle linear-gradients, so we'll need to approximate
    // For this app, the gradient is dark, so we'll return a dark color.
    if (cssColor.includes('linear-gradient')) {
        return { r: 30, g: 60, b: 114 }; // Approximate dark blue
    }
    return null;
}

function updateTextColor() {
    const body = document.body;
    const computedStyle = window.getComputedStyle(body);
    const backgroundColor = computedStyle.backgroundColor; // This will be an rgb value
    
    // For elements with linear-gradient, we need to handle them specially
    const backgroundStyle = computedStyle.background;
    
    let finalBackgroundColor = backgroundColor;
    if (backgroundStyle.includes('linear-gradient')) {
        finalBackgroundColor = 'linear-gradient'; // Special flag for our function
    }

    const fontColor = getFontColorForBackground(finalBackgroundColor);
    
    document.querySelectorAll('*').forEach(el => {
        el.style.setProperty('color', fontColor, 'important');
    });
}

window.addEventListener('load', () => {
    updateTextColor();

    // Optional: If the background can change dynamically, you might need a MutationObserver
    // For this case, we'll just run it once on load.
});
