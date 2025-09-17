// js/reflexia.js
// Простой контроллер навигации по шагам для страницы рефлексии

document.addEventListener('DOMContentLoaded', () => {
  const previousButton = document.getElementById('prev-btn');
  const nextButton = document.getElementById('next-btn');
  const stepIndicator = document.getElementById('step-indicator');
  const questionSteps = Array.from(document.querySelectorAll('.question-step'));
  const resultStep = document.getElementById('result-step');
  const resultImage = document.getElementById('result-image');
  const resultText = document.getElementById('result-text');
  const footerBar = document.querySelector('.reflexia-footer');

  let currentStep = 1;
  const totalSteps = questionSteps.length;

  let lastDirection = 'forward';

  function updateStepIndicator() {
    if (stepIndicator) {
      stepIndicator.textContent = `Шаг ${currentStep} из ${totalSteps}`;
    }
  }

  function hideResult() {
    if (resultStep) {
      resultStep.classList.remove('active');
    }
    if (footerBar) {
      footerBar.style.display = 'flex';
    }
  }

  function showOnlyCurrentStep(prevStepNumber) {
    const nextStep = questionSteps.find(el => Number(el.getAttribute('data-step')) === currentStep);
    const prevStep = typeof prevStepNumber === 'number'
      ? questionSteps.find(el => Number(el.getAttribute('data-step')) === prevStepNumber)
      : null;

    questionSteps.forEach((stepElement) => {
      const stepNumber = Number(stepElement.getAttribute('data-step'));
      if (stepNumber === currentStep) {
        stepElement.classList.add('active');
      } else {
        stepElement.classList.remove('active');
      }
      stepElement.classList.remove('animate-in-right','animate-in-left','animate-out-left','animate-out-right');
    });

    if (prevStep && nextStep && prevStep !== nextStep) {
      // Анимация: предыдущий уходит, следующий приходит
      prevStep.classList.add(lastDirection === 'forward' ? 'animate-out-left' : 'animate-out-right');
      nextStep.classList.add(lastDirection === 'forward' ? 'animate-in-right' : 'animate-in-left');
    }

    hideResult();
  }

  function updateButtons() {
    if (previousButton) {
      previousButton.disabled = currentStep === 1;
    }
    if (nextButton) {
      nextButton.textContent = currentStep === totalSteps ? 'Посмотреть результат' : 'Далее';
    }
  }

  function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    const prev = currentStep;
    lastDirection = step > currentStep ? 'forward' : 'backward';
    currentStep = step;
    showOnlyCurrentStep(prev);
    updateStepIndicator();
    updateButtons();
  }

  // Обработчики
  if (previousButton) {
    previousButton.addEventListener('click', () => {
      if (currentStep > 1) {
        goToStep(currentStep - 1);
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        goToStep(currentStep + 1);
      } else {
        // Подсчет выбранных чекбоксов по всем вопросам
        const allChecked = document.querySelectorAll('.question-step input[type="checkbox"]:checked');
        const checkedCount = allChecked.length;

        // Диапазоны: мало (1), средне (2), много (3)
        // Простая эвристика: до 3 — мало, 4-6 — средне, >6 — много
        let category = 1;
        if (checkedCount >= 4 && checkedCount <= 6) {
          category = 2;
        } else if (checkedCount > 6) {
          category = 3;
        }

        // Показ результата
        if (resultStep && resultImage && resultText) {
          questionSteps.forEach(s => {
            s.classList.remove('active','animate-in-right','animate-in-left','animate-out-left','animate-out-right');
          });
          resultStep.classList.add('active');

          // Относительный путь к изображениям
          resultImage.src = `img/${category}.png`;
          resultImage.alt = `Результат ${category}`;

          const messages = {
            1: 'Неплохо! Вы отметили немного пунктов — двигайтесь дальше и попробуйте больше.',
            2: 'Хороший прогресс! Средний уровень — вы на верном пути.',
            3: 'Отлично! Вы отметили много пунктов — выдающийся результат!'
          };
          resultText.textContent = messages[category];

          // Обновление индикатора шага
          if (stepIndicator) {
            stepIndicator.textContent = 'Результат';
          }

          // Скрыть нижнюю панель кнопок
          if (footerBar) footerBar.style.display = 'none';
        }
      }
    });
  }


  // Инициализация
  goToStep(1);
});


