
const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

const balanceBravery = spaceSize => Math.tanh(
  (spaceSize - 50) / 20
) / 4 + 1 / 4; // do you like magic?


export const guess = (dict, possibleWords, outLetters) => {
  const orderSum = possibleWords
    .map(w => dict.get(w))
    .reduce((a, b) => a + b);

  const getWeight = letter => {
    // 1 - Do not use
    // 0 - It's the best choice

    const containingPossibleWords = possibleWords
    .filter(w => w.includes(letter));

    if (possibleWords.length === containingPossibleWords.length) {
      return 0;
    }

    if (!containingPossibleWords.length) {
      return 1;
    }

    if (possibleWords.length === 1) {
      return possibleWords[0].includes(letter) ? 0 : 1;
    }

    let prior = containingPossibleWords.length / possibleWords.length;

    const letterOrderSum = containingPossibleWords
      .map(w => dict.get(w))
      .reduce((a, b) => a + b);

    prior *= letterOrderSum / orderSum;

    return Math.abs(prior - balanceBravery(possibleWords.length));
  };


  const candidates = alphabet
    .filter(l => !outLetters.includes(l))
    .map(l => [getWeight(l), l])
    .sort();

  return candidates.sort()[0][1];
};

export const getNewPossibleWords = (word, letter, possibleWords) => {
  if (word.includes(letter)) {
      word.map((l, i) => {
          if (l === letter) {
              possibleWords = possibleWords
                  .filter(w => w[i] === letter);
          } else {
              possibleWords = possibleWords
                  .filter(w => w[i] !== letter);
          }
      });
  } else {
      possibleWords = possibleWords.filter(w => !w.includes(letter));
  }
  return possibleWords;
};
