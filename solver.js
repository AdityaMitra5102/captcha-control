async function loadOpenCV() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.5.2/opencv.js';
        script.async = true;
        script.onload = () => {
            console.log('OpenCV.js loaded');
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
        document.head.appendChild(script);
    });
}

async function preprocessImage(imgElement) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.width;
        canvas.height = imgElement.height;
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        // Create OpenCV Mat from canvas
        const src = cv.imread(canvas);
        const dst = new cv.Mat();

        // Convert to grayscale
        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);

        // Apply adaptive thresholding to remove noise
        cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

        // Morphological operation to enhance digits
        const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(dst, dst, kernel);

        // Attempt to counter wave distortion (approximation)
        const mapX = new cv.Mat(dst.rows, dst.cols, cv.CV_32FC1);
        const mapY = new cv.Mat(dst.rows, dst.cols, cv.CV_32FC1);
        for (let y = 0; y < dst.rows; y++) {
            for (let x = 0; x < dst.cols; x++) {
                mapX.data32F[y * dst.cols + x] = x - 4 * Math.sin(y / 15.0);
                mapY.data32F[y * dst.cols + x] = y - 3 * Math.cos(x / 20.0);
            }
        }
        cv.remap(dst, dst, mapX, mapY, cv.INTER_LINEAR);

        // Write back to canvas
        cv.imshow(canvas, dst);
        src.delete();
        dst.delete();
        kernel.delete();
        mapX.delete();
        mapY.delete();

        resolve(canvas.toDataURL('image/png'));
    });
}

async function solveCaptcha(attempt = 1, maxAttempts = 5) {
    const worker = await Tesseract.createWorker({
        logger: m => console.log(m),
    });

    try {
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
            preserve_interword_spaces: '0',
        });

        const captchaImg = document.getElementById('captcha-img');
        const inputField = document.querySelector('input[name="captcha_input"]');

        // Preprocess the image
        const processedImage = await preprocessImage(captchaImg);

        // Perform OCR
        const { data: { text } } = await worker.recognize(processedImage);
        const digits = text.replace(/[^0-9]/g, '').slice(0, 6);

        if (digits.length === 6) {
            inputField.value = digits;
            console.log('CAPTCHA solved:', digits);
            // Optional: auto-submit (uncomment if needed)
            // document.querySelector('form').submit();
        } else {
            console.warn(`Attempt ${attempt} failed, extracted: "${text}". Retrying...`);
            if (attempt < maxAttempts) {
                refreshCaptcha();
                setTimeout(() => solveCaptcha(attempt + 1, maxAttempts), 1000);
            } else {
                console.error('Max retries reached. Unable to solve CAPTCHA.');
            }
        }
    } catch (error) {
        console.error('Error solving CAPTCHA:', error);
        if (attempt < maxAttempts) {
            refreshCaptcha();
            setTimeout(() => solveCaptcha(attempt + 1, maxAttempts), 1000);
        } else {
            console.error('Max retries reached:', error);
        }
    } finally {
        await worker.terminate();
    }
}


    try {
        // Load OpenCV.js first
        await loadOpenCV();
        // Load Tesseract.js
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/tesseract.js@4.0.2/dist/tesseract.min.js';
        script.onload = () => {
            console.log('Tesseract.js loaded');
            solveCaptcha();
        };
        script.onerror = () => console.error('Failed to load Tesseract.js');
        document.head.appendChild(script);

        // Override refreshCaptcha to re-run solver
        const originalRefreshCaptcha = refreshCaptcha;
        refreshCaptcha = function() {
            originalRefreshCaptcha();
            setTimeout(solveCaptcha, 1000);
        };
    } catch (error) {
        console.error('Failed to load dependencies:', error);
    }
