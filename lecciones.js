/* ============================================================
   KIVHORA · Contenido de las lecciones (Orden del mapa)
   ============================================================ */

var KIV_LESSONS = {
  1: { title: 'validación', icon: '✅', type: 'validation' },
  2: { 
    title: 'juego de memoria', icon: '🧠', type: 'memory',
    memory: ['🚀', '🐶', '🍎', '⚽', '💡', '🐱'],
    memoryQ: { q: '¿Cuál de estos emojis NO apareció?', options: ['🚀', '🌟', '🍎', '🐶'], answer: 1, explain: 'La estrella no estaba.' }
  },
  3: { 
    title: 'mín. 110 PPM', icon: '🏎️', type: 'reading', ppmTarget: 110,
    text: 'La lectura rápida es una habilidad que puede transformar la forma en que procesamos información. No se trata solo de leer más rápido, sino de hacerlo de manera más eficiente. Al reducir la subvocalización, liberamos a nuestro cerebro para procesar información a mayor velocidad. Los ojos humanos están diseñados para hacer movimientos rápidos y eficientes, capturando grupos de palabras en lugar de una por una.'
  },
  4: { 
    title: 'comprensión literal', subtitle: '(validación)', icon: '🔍', type: 'quiz',
    quiz: { q: 'Según el texto, ¿qué es la subvocalización?', options: ['Leer en voz alta', 'Pronunciar mentalmente cada palabra', 'Un tipo de letra', 'Mover los ojos'], answer: 1, explain: 'Es el hábito de pronunciar mentalmente.' }
  },
  5: { title: 'insignia', icon: '🏅', type: 'reward' },
  6: { 
    title: 'comprensión inferencial', icon: '💡', type: 'quiz',
    quiz: { q: 'Si reduces la subvocalización, ¿qué pasará?', options: ['Leerás más lento', 'Olvidarás lo que lees', 'Procesarás más rápido', 'Necesitarás leer en voz alta'], answer: 2, explain: 'Liberas capacidad cerebral.' }
  },
  7: { 
    title: 'pensamiento crítico', icon: '🤔', type: 'quiz',
    quiz: { q: '¿La lectura rápida es útil en tu vida diaria?', options: ['Sí, para estudiar', 'No, es mejor despacio', 'Solo para novelas', 'No tengo opinión'], answer: 0, explain: 'Te permite absorber más información.' }
  },
  8: { title: 'siguiente sección', icon: '🚀', type: 'milestone' }
};