let dictionary = {};
const fillDictionary = (a) => {
  // cyrillic part
  a["а"] = "a";
  a["б"] = "b";
  a["в"] = "v";
  a["г"] = "g";
  a["д"] = "d";
  a["ђ"] = "dj";
  a["е"] = "e";
  a["ж"] = "z";
  a["з"] = "z";
  a["и"] = "i";
  a["ј"] = "j";
  a["к"] = "k";
  a["л"] = "l";
  a["љ"] = "lj";
  a["м"] = "m";
  a["н"] = "n";
  a["њ"] = "nj";
  a["о"] = "o";
  a["п"] = "p";
  a["р"] = "r";
  a["с"] = "s";
  a["т"] = "t";
  a["ћ"] = "c";
  a["у"] = "u";
  a["ф"] = "f";
  a["х"] = "h";
  a["ц"] = "c";
  a["ч"] = "c";
  a["џ"] = "dz";
  a["ш"] = "s";
  a["А"] = "A";
  a["Б"] = "B";
  a["В"] = "V";
  a["Г"] = "G";
  a["Д"] = "D";
  a["Ђ"] = "DJ";
  a["Е"] = "E";
  a["Ж"] = "Z";
  a["З"] = "Z";
  a["И"] = "I";
  a["Ј"] = "J";
  a["К"] = "K";
  a["Л"] = "L";
  a["Љ"] = "LJ";
  a["М"] = "M";
  a["Н"] = "N";
  a["Њ"] = "NJ";
  a["О"] = "O";
  a["П"] = "P";
  a["Р"] = "R";
  a["С"] = "S";
  a["Т"] = "T";
  a["Ћ"] = "C";
  a["У"] = "U";
  a["Ф"] = "F";
  a["Х"] = "H";
  a["Ц"] = "C";
  a["Ч"] = "C";
  a["Џ"] = "DZ";
  a["Ш"] = "S";

  // latin part
  a["ć"] = "c";
  a["č"] = "c";
  a["ž"] = "z";
  a["š"] = "s";
  a["đ"] = "dj";
  a["dž"] = "dz";
  a["Ć"] = "c";
  a["Č"] = "c";
  a["Ž"] = "z";
  a["Š"] = "s";
  a["Đ"] = "dj";
  a["DŽ"] = "dz";
};

fillDictionary(dictionary);

async function transliterate(word) {
  let answer = "";

  word = word.replace("Belgrade", "Beograd").replace("Serbia", "Srbija");

  for (i in word) {
    if (word.hasOwnProperty(i)) {
      if (dictionary[word[i]] === undefined) {
        answer += word[i];
      } else {
        answer += dictionary[word[i]];
      }
    }
  }
  return answer.toLowerCase();
}

module.exports = { transliterate };
