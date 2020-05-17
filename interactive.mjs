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

  const data = {
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
      data.$errorsNumber.value >= MAX_ERRORS
    ) || (
      // I won
      data.$word.value &&
      data.$word.value.filter(l => !!l).length === data.$length.value
    ) || (
      // User guessed non-dict word
      !data.possibleWords || !data.possibleWords.length
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
    if (!data.dict) {
      return;
    }
    elements.done.innerHTML = "Done";
    data.possibleWords = Array.from(data.dict.keys()).filter(
      w => w.length === data.$length.value
    );
    data.$outLetters.next([]);
    data.$word.next(new Array(data.$length.value).fill(""));
    requestAnimationFrame(() => drawWordButtons(data.$length.value));
  };

  data.$length.subscribe(resetGame);
  rxjs.fromEvent(elements.refresh, "click").subscribe(resetGame);

  rxjs
    .combineLatest(data.$word, data.$outLetters)
    .pipe(
      rxjs.operators.debounceTime(100),
      rxjs.operators.filter(([word, outLetters]) => word && outLetters)
    )
    .subscribe(([word, outLetters]) => {
      data.$errorsNumber.next(
        outLetters.filter(l => !word.includes(l)).length,
      );

      if (!outLetters || isGameOwer()) {
        return;
      }

      data.$guessingLetter.next(
        guess(data.dict, data.possibleWords, outLetters),
      );
    });

  data.$guessingLetter.subscribe(l => {
    if (l) {
      elements.guess.innerHTML =
        `My guess is <b>${l}</b>\nClick on it, if there there's any`;
    } else {
      elements.guess.innerHTML = "Guessing...";
    }
  });

  data.$outLetters.subscribe(outLetters => {
    elements.outLetters.innerHTML = outLetters.filter(
      l => !data.$word.value.includes(l)
    ).join(" ");
  });

  rxjs.fromEvent(elements.word, "mouseout").subscribe(({ target }) => {
    if (target.parentNode !== elements.word) {
      return;
    }
    const index = +target.name;
    if (data.$word.value[index]) {
      return;
    }
    target.innerHTML = PLACEHOLDER;
  });

  rxjs.fromEvent(elements.word, "mouseover").subscribe(({ target }) => {
    if (
      target.parentNode !== elements.word || !data.$guessingLetter.value
    ) {
      return;
    }
    const index = +target.name;
    if (data.$word.value[index]) {
      return;
    }
    target.innerHTML = data.$guessingLetter.value;
  });

  rxjs.fromEvent(elements.word, "click").subscribe(event => {
    let { target } = event;
    const { parentNode, name } = target;
    if (parentNode !== elements.word || isGameOwer()) {
      return;
    }

    const letter = data.$guessingLetter.value;
    const index = +name;

    if (data.$word.value[index] && data.$word.value[index] !== letter) {
      return;
    }

    const newWord = [...data.$word.value];

    if (data.$word.value[index] === letter) {
      target.innerHTML = PLACEHOLDER;
      newWord[index] = "";
    } else {
      target.innerHTML = letter;
      newWord[index] = letter;
    }

    data.$word.next(newWord);
  });

  data.$word.subscribe(word => {
    if (word && word.filter(l => !!l).length === word.length) {
      endGame("Woohoo! I solved it.");
    }
  });

  data.$errorsNumber.subscribe(n => {
    window.requestAnimationFrame(() => {
      for (let i = 0; i < parts.length; i++) {
        const el = parts[i];
        if (i < n) {
          el.style.display = "block";
        } else {
          el.style.display = "none";
        }
      }
    });

    if (n >= MAX_ERRORS && data.$outLetters.value.length) {
      endGame(
        "You won! My guesses are:\n" +
        data.possibleWords.slice(0, 10).join(" ")
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

      data.possibleWords = getNewPossibleWords(
        data.$word.value,
        data.$guessingLetter.value,
        data.possibleWords,
      );

      if (!data.possibleWords.length) {
        endGame("I give up, I don't know this word");
        return;
      }

      data.$outLetters.next(
        [data.$guessingLetter.value, ...data.$outLetters.value],
      );
    });

  // update $length on change
  rxjs
    .fromEvent(elements.wordLengthInput, "change")
    .subscribe(({ target: { value } }) => {
      if (data.$length.value !== value) {
        if (value >= 3 && value <= 20) {
          data.$length.next(+value);
        } else {
          elements.wordLengthInput.value = data.$length.value;
        }
      }
    });

  console.debug(data);

  loadDictWithProgressBar()
    .then(words => {
      data.dict = new Map(words.map((w, i) => [w, i]));
      elements.loader.style.display = "none";
      elements.field.style.display = "block";
      resetGame();
    });
});
