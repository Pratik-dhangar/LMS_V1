/**
 * Fill in the Blanks Exercise Templates
 * Quick templates for creating common exercise types
 */

/**
 * Generate a unique ID for exercises
 */
export const generateExerciseId = () => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

/**
 * Template: Prepositions Exercise
 * Based on the example images provided (cat in/on/under box)
 */
export const createPrepositionsExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 500,
  title: 'Prepositions Exercise',
  instructions: 'Fill in the blanks with the correct preposition (in, on, under, next to)',
  options: ['in', 'on', 'under', 'next to'],
  blanks: [
    {
      textBefore: 'The cat is',
      textAfter: 'the box.',
      correctAnswer: 'on'
    },
    {
      textBefore: 'The cat is',
      textAfter: 'the box.',
      correctAnswer: 'in'
    },
    {
      textBefore: 'The cat is',
      textAfter: 'the box.',
      correctAnswer: 'under'
    },
    {
      textBefore: 'The cat is',
      textAfter: 'the table.',
      correctAnswer: 'on'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false  // Trainer grants permission to interact
});

/**
 * Template: Where is Teddy? (Based on the provided worksheet image)
 */
export const createWhereIsTeddyExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 500,
  title: 'Where is Teddy?',
  instructions: 'Fill in the blanks: in, on, under, next to',
  options: ['in', 'on', 'under', 'next to'],
  blanks: [
    {
      textBefore: 'Teddy is',
      textAfter: 'the box.',
      correctAnswer: 'in'
    },
    {
      textBefore: 'Teddy is',
      textAfter: 'the table.',
      correctAnswer: 'next to'
    },
    {
      textBefore: 'Teddy is',
      textAfter: 'the table.',
      correctAnswer: 'on'
    },
    {
      textBefore: 'Teddy is',
      textAfter: 'the table.',
      correctAnswer: 'under'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false
});

/**
 * Template: Verb Tenses Exercise
 */
export const createVerbTenseExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 450,
  title: 'Past Tense Exercise',
  instructions: 'Write the past tense form of each verb',
  blanks: [
    {
      textBefore: 'I',
      textAfter: 'to school yesterday. (go)',
      correctAnswer: 'went'
    },
    {
      textBefore: 'She',
      textAfter: 'a delicious cake. (bake)',
      correctAnswer: 'baked'
    },
    {
      textBefore: 'They',
      textAfter: 'soccer in the park. (play)',
      correctAnswer: 'played'
    },
    {
      textBefore: 'He',
      textAfter: 'his homework early. (finish)',
      correctAnswer: 'finished'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false
});

/**
 * Template: Articles (a/an/the) Exercise
 */
export const createArticlesExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 450,
  title: 'Articles Exercise',
  instructions: 'Fill in the correct article: a, an, or the',
  options: ['a', 'an', 'the'],
  blanks: [
    {
      textBefore: 'I saw',
      textAfter: 'elephant at the zoo.',
      correctAnswer: 'an'
    },
    {
      textBefore: 'She has',
      textAfter: 'beautiful garden.',
      correctAnswer: 'a'
    },
    {
      textBefore: 'Look at',
      textAfter: 'moon tonight!',
      correctAnswer: 'the'
    },
    {
      textBefore: 'He wants',
      textAfter: 'apple for lunch.',
      correctAnswer: 'an'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false
});

/**
 * Template: Vocabulary - Animal Sounds
 */
export const createAnimalSoundsExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 450,
  title: 'Animal Sounds',
  instructions: 'Complete the sentences with the correct animal sound',
  options: ['meow', 'woof', 'moo', 'oink', 'quack'],
  blanks: [
    {
      textBefore: 'A cat says',
      textAfter: '',
      correctAnswer: 'meow'
    },
    {
      textBefore: 'A dog says',
      textAfter: '',
      correctAnswer: 'woof'
    },
    {
      textBefore: 'A cow says',
      textAfter: '',
      correctAnswer: 'moo'
    },
    {
      textBefore: 'A duck says',
      textAfter: '',
      correctAnswer: 'quack'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false
});

/**
 * Template: Numbers and Counting
 */
export const createNumbersExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 450,
  title: 'Numbers Exercise',
  instructions: 'Write the missing numbers',
  blanks: [
    {
      textBefore: 'One, two, three,',
      textAfter: ', five',
      correctAnswer: 'four'
    },
    {
      textBefore: 'Five, six, seven,',
      textAfter: ', nine',
      correctAnswer: 'eight'
    },
    {
      textBefore: 'Ten, twenty, thirty,',
      textAfter: ', fifty',
      correctAnswer: 'forty'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false
});

/**
 * Template: Colors Exercise
 */
export const createColorsExercise = () => ({
  id: generateExerciseId(),
  type: 'fill-in-blanks',
  x: 50,
  y: 50,
  width: 600,
  height: 450,
  title: 'Colors Exercise',
  instructions: 'Fill in the color names',
  options: ['red', 'blue', 'green', 'yellow', 'orange'],
  blanks: [
    {
      textBefore: 'The sun is',
      textAfter: '',
      correctAnswer: 'yellow'
    },
    {
      textBefore: 'The grass is',
      textAfter: '',
      correctAnswer: 'green'
    },
    {
      textBefore: 'The sky is',
      textAfter: '',
      correctAnswer: 'blue'
    },
    {
      textBefore: 'An apple can be',
      textAfter: '',
      correctAnswer: 'red'
    }
  ],
  answers: {},
  showFeedback: true,
  allowLearnerInteraction: false
});

/**
 * Create a custom exercise
 * @param {Object} config - Exercise configuration
 * @returns {Object} Exercise object
 */
export const createCustomExercise = (config) => {
  const defaults = {
    id: generateExerciseId(),
    type: 'fill-in-blanks',
    x: 50,
    y: 50,
    width: 600,
    height: 500,
    title: 'Custom Exercise',
    instructions: 'Complete the exercise',
    options: [],
    blanks: [],
    answers: {},
    showFeedback: true,
    allowLearnerInteraction: false
  };

  return { ...defaults, ...config };
};

/**
 * Export all template functions
 */
export const exerciseTemplates = {
  prepositions: createPrepositionsExercise,
  whereIsTeddy: createWhereIsTeddyExercise,
  verbTenses: createVerbTenseExercise,
  articles: createArticlesExercise,
  animalSounds: createAnimalSoundsExercise,
  numbers: createNumbersExercise,
  colors: createColorsExercise,
  custom: createCustomExercise
};

export default exerciseTemplates;
