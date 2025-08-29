const { createWorker } = Tesseract;

async function solveCaptcha() {
    // Create Tesseract worker
    const worker = await createWorker({
        logger: m => console.log(m), // Optional: for debugging
    });

    // Initialize Tesseract with English language and numbers-only configuration
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
        tessedit_char_whitelist: '0123456789', // Restrict to digits
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, // Optimize for single line of text
    });

    // Get the CAPTCHA image element
    const captchaImg = document.getElementById('captcha-img');
    const inputField = document.querySelector('input[name="captcha_input"]');

    try {
        // Perform OCR on the CAPTCHA image
        const { data: { text } } = await worker.recognize(captchaImg.src);

        // Clean the extracted text to get only digits
        const digits = text.replace(/[^0-9]/g, '').slice(0, 6);

        if (digits.length === 6) {
            // Fill the input field with the extracted digits
            inputField.value = digits;
            console.log('CAPTCHA solved:', digits);

            // Optionally, auto-submit the form (uncomment if needed)
            // document.querySelector('form').submit();
        } else {
            console.warn('Could not extract 6 digits, retrying...');
            // Refresh CAPTCHA and try again
            refreshCaptcha();
            setTimeout(solveCaptcha, 1000); // Wait 1 second before retrying
        }
    } catch (error) {
        console.error('Error solving CAPTCHA:', error);
        // Refresh CAPTCHA on error
        refreshCaptcha();
        setTimeout(solveCaptcha, 1000); // Wait 1 second before retrying
    } finally {
        // Terminate the worker to free resources
        await worker.terminate();
    }
}

// Load Tesseract.js and start solving when the page is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load Tesseract.js from CDN
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tesseract.js@4.0.2/dist/tesseract.min.js';
    script.onload = () => {
        console.log('Tesseract.js loaded');
        solveCaptcha();
    };
    script.onerror = () => console.error('Failed to load Tesseract.js');
    document.head.appendChild(script);

    // Override the refreshCaptcha function to re-run the solver after refresh
    const originalRefreshCaptcha = refreshCaptcha;
    refreshCaptcha = function() {
        originalRefreshCaptcha();
        setTimeout(solveCaptcha, 1000); // Run solver after refreshing
    };
});
