import { getNewPossibleWords, guess } from "./solver.mjs";
import { readFileSync, writeFileSync } from "fs";


const getErrorsNumber = (word, dict) => {
    const guessedLetters = [];
    let possibleWords = Array.from(dict.keys())
        .filter(w => w.length === word.length);
    let errors = 0;
    // eslint-disable-next-line no-console
    console.log(word);
    word = Array.from(word);
    while (true) {
        const letter = guess(dict, possibleWords, guessedLetters);
        guessedLetters.push(letter);
        if (word.includes(letter)) {
            if (
                word
                .filter(l => guessedLetters.includes(l))
                .length === word.length
            ) {
                return errors;
            }
        } else {
            errors += 1;
        }
        possibleWords = getNewPossibleWords(word, letter, possibleWords);
    }
};


const main = () => {
    let words = JSON.parse(readFileSync("./static/dictionary.json"));
    const dict = new Map(words.map((w, i) => [w, i]));

    const errors = words
        .map(word => [word, getErrorsNumber(word, dict)]);
    writeFileSync("errors.json", JSON.stringify(errors));
};

main();
