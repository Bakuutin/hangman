document.addEventListener("DOMContentLoaded", () => {
  const rxjs = window.rxjs;
  const DICT_URL =
    "https://cdn.glitch.com/92043d52-dc69-4161-a2b3-30582d8c3642%2Fdictionary.json?v=1588683879996";

  const elements = Object.fromEntries(
    [
      "loader",
      "field",
      "word",
      "wordLengthInput",
      "lettersContainer",
      "bodyContainer",
      "head",
      "body",
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg"
    ].map(id => [id, document.getElementById(id)])
  );

  const parts = [
    elements.head,
    elements.body,
    elements.leftArm,
    elements.rightArm,
    elements.leftLeg,
    elements.rightLeg
  ];

  const loadDictWithProgressBar = async () => {
    const response = await fetch(DICT_URL);
    const reader = response.body.getReader();
    const contentLength = +response.headers.get("Content-Length");

    let receivedLength = 0; // bytes
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
    return new Map(JSON.parse(result));
  };

  const data = {
    dict: null,
    $word: new rxjs.BehaviorSubject(),
    $length: new rxjs.BehaviorSubject(5),
    $errors: new rxjs.BehaviorSubject(6),
    possibleWords: [],
    $letterClick: new rxjs.Subject(),
    $guessingLetter: new rxjs.BehaviorSubject(),
    $outLetters: new rxjs.BehaviorSubject([])
  };

  const gameOwer = msg => {
    window.setTimeout(() => {
      alert(msg);
      reset();
    }, 1000);
  };

  const reset = () => {
    if (!length || !data.dict) {
      return;
    }

    data.possibleWords = Array.from(data.dict.keys()).filter(
      w => w.length === data.$length.value
    );

    data.$outLetters.next([]);
    elements.word.style.display = "flex";

    const arr = new Array(data.$length.value).fill("");
    data.$word.next(arr);

    while (elements.word.lastElementChild) {
      elements.word.removeChild(elements.word.lastElementChild);
    }
    arr.map((value, index) => {
      const el = document.createElement("input");
      el.setAttribute("type", "text");
      el.setAttribute("maxlength", 1);
      el.setAttribute("name", index);
      elements.word.appendChild(el);
    });
  };

  data.$length.subscribe(reset);

  const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  data.$outLetters.subscribe(outLetters => {
    if (!data.possibleWords || !outLetters) {
      return;
    }

    const getWeight = l => {
      if (data.possibleWords.length > 1) {
        const possibilty =
          data.possibleWords.filter(w => w.includes(l)).length /
          data.possibleWords.length;
        return Math.abs(possibilty - 0.5);
      }

      const word = data.possibleWords[0];

      // assuming l not in outLetters
      return word.includes(l) ? 0 : 1;
    };

    const candidates = alphabet
      .filter(l => !outLetters.includes(l))
      .map(l => [getWeight(l), l])
      .sort();

    data.$guessingLetter.next(candidates.sort()[0][1]);
  });

  rxjs
    .combineLatest(data.$guessingLetter, data.$outLetters)
    .subscribe(([guessingLetter, outLetters]) => {
      window.requestAnimationFrame(() => {
        Array.from(elements.lettersContainer.querySelectorAll("button")).map(
          el => {
            const letter = el.textContent;

            while (el.classList.length) {
              el.classList.remove(el.classList[0]);
            }

            if (guessingLetter === letter) {
              el.classList.add("active");
            } else if (outLetters.includes(letter)) {
              el.classList.add("out");
            }
          }
        );
      });
    });

  const goNextFreeSibling = el => {
    while (el.nextSibling) {
      if (!el.nextSibling.value) {
        el.nextSibling.focus();
        return;
      }
      el = el.nextSibling;
    }
  };

  const goPrevFreeSibling = el => {
    while (el.previousSibling) {
      if (!el.previousSibling.value) {
        el.previousSibling.focus();
        return;
      }
      el = el.previousSibling;
    }
  };

  // process letter enter
  rxjs.fromEvent(elements.word, "keydown").subscribe(event => {
    let { target, key, code } = event;

    if (key === "Tab" || key === "Shift") {
      return;
    }

    event.preventDefault();

    const { parentNode, name } = target;
    if (parentNode !== elements.word) {
      return;
    }

    switch (key) {
      case "Backspace":
        goPrevFreeSibling(target);
        return;
      case "ArrowLeft":
        goPrevFreeSibling(target);
        return;
      case "ArrowRight":
        goNextFreeSibling(target);
        return;
      case "Enter":
        key = data.$guessingLetter.value;
        break;
    }

    const letter = key.toUpperCase();
    if (letter !== data.$guessingLetter.value || target.value) {
      while (target.nextSibling && target.nextSibling.value) {
        target.nextSibling.focus();
        target = target.nextSibling;
      }
      return;
    }
    const index = +name;
    target.value = letter;
    target.setAttribute("readonly", 1);
    const newWord = [...data.$word.value];
    newWord[index] = letter;
    goNextFreeSibling(target);

    data.possibleWords = data.possibleWords.filter(w => w[index] === letter);

    if (!data.possibleWords.length) {
      gameOwer("You made this word up! You loose.");
      return;
    }

    if (newWord.filter(l => !!l).length == newWord.length) {
      const word = data.possibleWords[0];
      gameOwer(`Woohoo! ${word} means ${data.dict.get(word)}`);
      return;
    }

    data.$word.next(newWord);
  });

  data.$errors.subscribe(n => {
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

    if (n >= 6 && data.$outLetters.value.length) {
      gameOwer(
        "You won! My best guesses are:\n" +
          data.possibleWords.slice(0, 50).join("\n")
      );
    }
  });

  rxjs
    .combineLatest(data.$letterClick, data.$guessingLetter, data.$word)
    .subscribe(([letter, guessingLetter, word]) => {
      if (letter === guessingLetter) {
        data.possibleWords = data.possibleWords.filter(w => {
          for (let i = 0; i < w.length; i++) {
            if (!word[i] && w[i] === letter) {
              return false;
            }
          }
          return true;
        });
        data.$outLetters.next([letter, ...data.$outLetters.value]);
      }
    });

  rxjs
    .combineLatest(data.$word, data.$outLetters)
    .subscribe(([word, outLetters]) => {
      data.$errors.next(outLetters.filter(l => !word.includes(l)).length);
    });

  // process letter click
  rxjs
    .fromEvent(elements.lettersContainer, "click")
    .subscribe(({ target: { textContent, parentNode } }) => {
      if (parentNode.parentNode !== elements.lettersContainer) {
        return;
      }
      data.$letterClick.next(textContent);
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

  console.log(data);

  loadDictWithProgressBar()
    .then(value => (data.dict = value))
    .then(() => {
      elements.loader.style.display = "none";
      elements.field.style.display = "block";
    })
    .then(reset);
});
