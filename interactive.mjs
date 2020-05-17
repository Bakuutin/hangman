import { getNewPossibleWords, guess } from "./solver.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const MAX_ERRORS = 6;
  const PLACEHOLDER = "×";

  const elements = Object.fromEntries(
    [
      "loader",
      "field",
      "word",
      "wordLengthInput",
      "guess",
      "outLetters",
      "done",
      "refresh",
      "bodyContainer",
      "head",
      "body",
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg",
    ].map(id => [id, document.getElementById(id)])
  );

  const parts = [
    elements.head,
    elements.body,
    elements.leftArm,
    elements.rightArm,
    elements.leftLeg,
    elements.rightLeg,
  ];

  const loadDictWithProgressBar = async () => {
    const response = await fetch("./static/dictionary.json");
    const reader = response.body.getReader();
    const contentLength = +response.headers.get("Content-Length");

    let receivedLength = 0;
    let percent = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      receivedLength += value.length;

      percent = Math.round((receivedLength / contentLength) * 100);
      window.requestAnimationFrame(
        () => (elements.loader.style.width = `${percent}%`)
      );
    }

    const bytes = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      bytes.set(chunk, position);
      position += chunk.length;
    }

    const result = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(result);
  };

  // store state here
  const state = {
    dict: null,
    $word: new rxjs.BehaviorSubject(),
    $length: new rxjs.BehaviorSubject(5),
    $errorsNumber: new rxjs.BehaviorSubject(0),
    possibleWords: null,
    $doneClick: new rxjs.Subject(),
    $guessingLetter: new rxjs.BehaviorSubject(),
    $outLetters: new rxjs.BehaviorSubject([]),
  };

  const isGameOwer = () => (
    (
      // I lost
      state.$errorsNumber.value >= MAX_ERRORS
    ) || (
      // I won
      state.$word.value &&
      state.$word.value.filter(l => !!l).length === state.$length.value
    ) || (
      // User guessed non-dict word
      !state.possibleWords || !state.possibleWords.length
    )
  );


  const endGame = msg => {
    elements.done.innerHTML = "Again <img src='static/refresh.svg'>";
    elements.guess.innerHTML = msg;
  };

  const drawWordButtons = len => {
    while (elements.word.lastElementChild) {
      elements.word.removeChild(elements.word.lastElementChild);
    }
    Array.from({ length: len }, (_, index) => {
      const el = document.createElement("button");
      el.setAttribute("type", "text");
      el.setAttribute("name", index);
      el.innerHTML = PLACEHOLDER;
      elements.word.appendChild(el);
    });
  };

  const resetGame = () => {
    if (!state.dict) {
      return;
    }
    elements.done.innerHTML = "Done";
    state.possibleWords = Array.from(state.dict.keys()).filter(
      w => w.length === state.$length.value
    );
    state.$outLetters.next([]);
    state.$word.next(new Array(state.$length.value).fill(""));
    requestAnimationFrame(() => drawWordButtons(state.$length.value));
  };

  state.$length.subscribe(resetGame);
  rxjs.fromEvent(elements.refresh, "click").subscribe(resetGame);

  // show or hide refresh button
  state.$outLetters.subscribe(outLetters => elements.refresh.classList.toggle(
    "hide", !outLetters.length && !isGameOwer()
  ));

  // guess next letter
  rxjs
    .combineLatest(state.$word, state.$outLetters)
    .pipe(
      rxjs.operators.debounceTime(100),
      rxjs.operators.filter(([word, outLetters]) => word && outLetters)
    )
    .subscribe(([word, outLetters]) => {
      state.$errorsNumber.next(
        outLetters.filter(l => !word.includes(l)).length,
      );

      if (!outLetters || isGameOwer()) {
        return;
      }

      state.$guessingLetter.next(
        guess(state.dict, state.possibleWords, outLetters),
      );
    });

  state.$guessingLetter.subscribe(l => {
    if (l) {
      elements.guess.innerHTML =
        `My guess is <b>${l}</b>\nClick on it, if there there's any`;
    } else {
      elements.guess.innerHTML = "Guessing...";
    }
  });

  state.$outLetters.subscribe(outLetters => {
    elements.outLetters.innerHTML = outLetters.filter(
      l => !state.$word.value.includes(l)
    ).join(" ");
  });

  rxjs.fromEvent(elements.word, "mouseout").subscribe(({ target }) => {
    if (target.parentNode !== elements.word) {
      return;
    }
    const index = +target.name;
    if (state.$word.value[index]) {
      return;
    }
    target.innerHTML = PLACEHOLDER;
  });

  rxjs.fromEvent(elements.word, "mouseover").subscribe(({ target }) => {
    if (
      target.parentNode !== elements.word || !state.$guessingLetter.value
    ) {
      return;
    }
    const index = +target.name;
    if (state.$word.value[index]) {
      return;
    }
    target.innerHTML = state.$guessingLetter.value;
  });

  rxjs.fromEvent(elements.word, "click").subscribe(event => {
    let { target } = event;
    const { parentNode, name } = target;
    if (parentNode !== elements.word || isGameOwer()) {
      return;
    }

    const letter = state.$guessingLetter.value;
    const index = +name;

    if (state.$word.value[index] && state.$word.value[index] !== letter) {
      return;
    }

    const newWord = [...state.$word.value];

    if (state.$word.value[index] === letter) {
      target.innerHTML = PLACEHOLDER;
      newWord[index] = "";
    } else {
      target.innerHTML = letter;
      newWord[index] = letter;
    }

    state.$word.next(newWord);
  });

  state.$word.subscribe(word => {
    if (word && word.filter(l => !!l).length === word.length) {
      endGame("Woohoo! I solved it.");
    }
  });

  state.$errorsNumber.subscribe(n => {
    window.requestAnimationFrame(() => {
      for (let i = 0; i < parts.length; i++) {
        const el = parts[i];
        el.classList.toggle("hide", i >= n);
      }
    });

    if (n >= MAX_ERRORS && state.$outLetters.value.length) {
      endGame(
        "You won! My guesses are:\n" +
        state.possibleWords.slice(0, 10).join(" ")
      );
    }
  });

  rxjs
    .fromEvent(elements.done, "click")
    .pipe(rxjs.operators.debounceTime(200))
    .subscribe(() => {
      if (isGameOwer()) {
        resetGame();
        return;
      }

      state.possibleWords = getNewPossibleWords(
        state.$word.value,
        state.$guessingLetter.value,
        state.possibleWords,
      );

      if (!state.possibleWords.length) {
        endGame("I give up, I don't know this word");
        return;
      }

      state.$outLetters.next(
        [state.$guessingLetter.value, ...state.$outLetters.value],
      );
    });

  // update $length on change
  rxjs
    .fromEvent(elements.wordLengthInput, "change")
    .subscribe(({ target: { value } }) => {
      if (state.$length.value !== value) {
        if (value >= 3 && value <= 20) {
          state.$length.next(+value);
        } else {
          elements.wordLengthInput.value = state.$length.value;
        }
      }
    });

  window.state = state; // for debug purposes

  loadDictWithProgressBar()
    .then(words => {
      state.dict = new Map(words.map((w, i) => [w, i]));
      elements.loader.style.display = "none";
      elements.field.style.display = "block";
      resetGame();
    });
});
