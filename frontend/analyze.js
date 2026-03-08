const textElement = document.querySelector(".input-box");
const optionElement = document.querySelector(".tone-select");
const resultElement = document.querySelector(".results");
const improveElement = document.querySelector(".improvements");
const button = document.querySelector(".analyze-btn");
const charCount = document.querySelector(".char-count");

// INTRO ANIMATION
window.addEventListener("load", () => {
  const intro = document.querySelector(".intro");

  if (!intro) return;

  function hideIntro() {
    intro.style.opacity = "0";
    intro.style.pointerEvents = "none";
  }

  setTimeout(hideIntro, 1500);
  intro.addEventListener("click", hideIntro);
});

// CHARACTER COUNTER
function updateCharCount() {
  charCount.textContent = `${textElement.value.length} characters`;
}

if (textElement && charCount) {
  textElement.addEventListener("input", updateCharCount);
  updateCharCount();
}

// API CALL
async function analyzeText() {
  const textElementValue = textElement.value;
  const optionElementValue = optionElement.value;

  try {
    const response = await fetch("https://politicly-winier-dona.ngrok-free.dev/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textElementValue,
        target_tone: optionElementValue,
      }),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();

    return {
      predictions: data.predictions,
      suggestions: data.suggestions,
    };
  } catch (error) {
    console.error(error);

    resultElement.innerHTML = "⚠️ Unable to analyze tone. Please try again.";

    return null;
  }
}

// RENDER RESULTS
function renderResult(predictions, suggestions) {
  let html = "";
  let htmlAgain = "";

  html += `
  <h2>Detected Tone</h2>

  <div class="bar">
      <span class="result-tone">${predictions[0].label}</span>
      <div class="progress">
          <div class="value" data-width="${predictions[0].confidence}%"></div>
      </div>
      <span>${predictions[0].confidence}%</span>
  </div>

  <div class="bar">
      <span>${predictions[1].label}</span>
      <div class="progress">
          <div class="value small" data-width="${predictions[1].confidence}%"></div>
      </div>
      <span>${predictions[1].confidence}%</span>
  </div>
  `;

  resultElement.innerHTML = `<div class="fade-in">${html}</div>`;

  htmlAgain += `
  <h2>Improvements</h2>

  <div class="card">
      <p>${suggestions[0]}</p>
      <button class="copy">Copy</button>
  </div>

  <div class="card">
      <p>${suggestions[1]}</p>
      <button class="copy">Copy</button>
  </div>

  <div class="card">
      <p>${suggestions[2]}</p>
      <button class="copy">Copy</button>
  </div>
  `;

  improveElement.innerHTML = `<div class="fade-in">${htmlAgain}</div>`;

  // PROGRESS BAR ANIMATION
  setTimeout(() => {
    document.querySelectorAll(".value").forEach((bar) => {
      bar.style.width = bar.dataset.width;
    });
  }, 50);

  // COPY BUTTON
  document.querySelectorAll(".copy").forEach((btn) => {
    btn.addEventListener("click", function () {
      const text = this.previousElementSibling.textContent;

      navigator.clipboard.writeText(text);

      this.textContent = "Copied!";

      setTimeout(() => {
        this.textContent = "Copy";
      }, 1500);
    });
  });

  // AUTO SCROLL
  setTimeout(() => {
    resultElement.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 150);
}

// MAIN FUNCTION
async function runAll() {
  if (!textElement.value.trim()) {
    resultElement.innerHTML = "Please enter text to analyze.";

    return;
  }

  button.disabled = true;

  // LOADING SPINNER
  resultElement.innerHTML = `
  <div class="spinner"></div>
  <p style="text-align:center;opacity:0.7;">
  Analyzing tone...
  </p>
  `;

  improveElement.innerHTML = "";

  const result = await analyzeText();

  if (!result) {
    button.disabled = false;
    return;
  }

  renderResult(result.predictions, result.suggestions);

  button.disabled = false;
}

// BUTTON CLICK
button.addEventListener("click", runAll);

// CTRL + ENTER SUBMIT
textElement.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    runAll();
  }
});
