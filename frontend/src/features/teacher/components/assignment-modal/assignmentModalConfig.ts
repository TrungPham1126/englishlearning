import type { SkillKey } from "../../utils/assignmentImport";

export interface QuestionDraft {
  id: string;
  prompt: string;
  questionType:
    | "MULTIPLE_CHOICE"
    | "FILL_IN_BLANK"
    | "AUDIO_RESPONSE"
    | "ESSAY"
    | "TRUE_FALSE"
    | "MATCHING";
  options: string[];
  correctAnswer: string;
  explanation?: string;
  referenceAudioUrl?: string;
  ipa?: string;
  targetWord?: string;
  transcript?: string;
  points?: number;
}

export interface SubPartItem {
  code: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const SUB_PARTS_CONFIG: Record<string, SubPartItem[]> = {
  LISTENING: [
    {
      code: "LISTENING_MC",
      label: "Phần 1: Nghe làm quen (Trắc nghiệm)",
      shortLabel: "Nghe làm quen (Trắc nghiệm)",
      description: "Học sinh nghe audio hoặc hội thoại ngắn và chọn 1 trong 4 phương án đúng.",
    },
    {
      code: "LISTENING_FILL",
      label: "Phần 2: Nghe điền từ vào ô trống (Gap-filling / Dictation)",
      shortLabel: "Nghe điền từ (Gap-filling)",
      description: "Học sinh nghe câu hoàn chỉnh và điền đúng từ khóa hoặc số liệu vào chỗ trống.",
    },
    {
      code: "LISTENING_DIALOGUE",
      label: "Phần 3: Nghe hội thoại tình huống giao tiếp",
      shortLabel: "Nghe hội thoại",
      description: "Nghe đoạn đối thoại 2 người và trả lời câu hỏi về chi tiết & ý định người nói.",
    },
    {
      code: "LISTENING_MIXED",
      label: "Tổng hợp các dạng bài Nghe (Hỗn hợp)",
      shortLabel: "Tổng hợp các dạng Nghe",
      description: "Kết hợp cả trắc nghiệm ý chính lẫn điền từ khuyết theo bài nghe.",
    },
  ],
  GRAMMAR: [
    {
      code: "GRAMMAR_VERB_CONJUGATION",
      label: "Phần 1: Chia động từ theo thì & ngữ cảnh (Verb Conjugation)",
      shortLabel: "Chia động từ (Verb Conjugation)",
      description: "Cho câu có động từ nguyên mẫu trong ngoặc, học sinh chia đúng thì ngữ pháp.",
    },
    {
      code: "GRAMMAR_WORD_ARRANGEMENT",
      label: "Phần 2: Sắp xếp từ thành câu hoàn chỉnh (Word Unscramble)",
      shortLabel: "Sắp xếp từ (Word Unscramble)",
      description: "Các từ bị xáo trộn, học sinh bấm chip tương tác Duolingo-style ghép thành câu chuẩn.",
    },
    {
      code: "GRAMMAR_ERROR_CORRECTION",
      label: "Phần 3: Tìm và sửa lỗi sai trong câu (Error Identification)",
      shortLabel: "Tìm & sửa lỗi sai",
      description: "Mỗi câu chứa 1 lỗi sai ngữ pháp, học sinh phát hiện và viết lại từ đúng.",
    },
    {
      code: "GRAMMAR_TRANSFORMATION",
      label: "Phần 4: Viết lại câu giữ nguyên nghĩa (Sentence Transformation)",
      shortLabel: "Viết lại câu giữ nguyên nghĩa",
      description: "Viết lại câu theo cấu trúc mới (chủ động sang bị động, câu điều kiện, đảo ngữ...).",
    },
    {
      code: "GRAMMAR_MULTIPLE_CHOICE",
      label: "Phần 5: Trắc nghiệm quy tắc & cấu trúc ngữ pháp",
      shortLabel: "Trắc nghiệm cấu trúc",
      description: "4 phương án kiểm tra thì, trợ động từ, mạo từ, giới từ và liên từ.",
    },
    {
      code: "GRAMMAR_MIXED",
      label: "Tổng hợp các dạng bài Ngữ pháp (Hỗn hợp)",
      shortLabel: "Tổng hợp Ngữ pháp",
      description: "Bộ bài tập kết hợp nhiều dạng bài ngữ pháp đa dạng.",
    },
  ],
  READING: [
    {
      code: "READING_FILL_BLANK",
      label: "Phần 1: Điền từ vào ô trống dựa vào bài đọc (Short Answer / Fact)",
      shortLabel: "Điền từ theo bài đọc",
      description: "Đọc bài và lấy dữ kiện trực tiếp điền vào ô trống. AI phân biệt hiểu ý vs lỗi ngữ pháp nhẹ.",
    },
    {
      code: "READING_TRUE_FALSE",
      label: "Phần 2: Xác định Đúng / Sai / Không có trong bài (True / False / Not Given)",
      shortLabel: "Đọc hiểu True/False/NG",
      description: "Đánh giá các nhận định dựa trên tính xác thực của dữ kiện trong bài đọc.",
    },
    {
      code: "READING_MULTIPLE_CHOICE",
      label: "Phần 3: Trắc nghiệm đọc hiểu chi tiết & ý chính",
      shortLabel: "Trắc nghiệm đọc hiểu",
      description: "4 lựa chọn phân tích thông tin chi tiết, ý chính và thái độ tác giả.",
    },
    {
      code: "READING_PARAPHRASE",
      label: "Phần 4: Nhận diện Paraphrasing & Suy luận học thuật (Inference)",
      shortLabel: "Paraphrase & Suy luận",
      description: "Kiểm tra kỹ năng tìm từ đồng nghĩa biến thể và suy luận logic ngầm.",
    },
    {
      code: "READING_MIXED",
      label: "Tổng hợp các dạng câu hỏi Đọc hiểu (Hỗn hợp)",
      shortLabel: "Tổng hợp Đọc hiểu",
      description: "Bộ đề kết hợp đoạn văn song song và nhiều dạng câu hỏi.",
    },
  ],
  VOCABULARY: [
    {
      code: "VOCAB_LISTEN_CHOOSE",
      label: "Dạng 1: Nghe & Chọn từ (Listen & Choose Word)",
      shortLabel: "Nghe & Chọn từ",
      description: "Hệ thống phát âm từ tiếng Anh, người học nghe và chọn 1 trong 4 từ tương ứng.",
    },
    {
      code: "VOCAB_DICTATION",
      label: "Dạng 2: Nghe chính tả điền từ (Listen & Type Word)",
      shortLabel: "Nghe chính tả điền từ",
      description: "Hệ thống phát âm từ tiếng Anh, người học nghe và gõ chính xác từ vựng vào ô trống.",
    },
    {
      code: "VOCAB_MEANING_TO_WORD",
      label: "Dạng 3: Định nghĩa -> Từ (Definition / Meaning to Word)",
      shortLabel: "Định nghĩa -> Từ",
      description: "Đọc định nghĩa hoặc nghĩa tiếng Việt/tiếng Anh và nhập từ vựng tiếng Anh tương ứng.",
    },
    {
      code: "VOCAB_WORD_FORM",
      label: "Dạng 4: Dạng từ trong câu (Word Form in Context)",
      shortLabel: "Dạng từ trong câu",
      description: "Cho câu có từ gốc trong ngoặc, điền dạng Danh từ / Động từ / Tính từ / Trạng từ phù hợp.",
    },
    {
      code: "VOCAB_MATCHING",
      label: "Dạng 5: Nối từ với nghĩa (Word-Definition Matching)",
      shortLabel: "Nối từ với nghĩa",
      description: "Ghép các cặp từ vựng với định nghĩa hoặc nghĩa tiếng Việt tương ứng.",
    },
    {
      code: "VOCAB_SYNONYM_ANTONYM",
      label: "Dạng 6: Đồng nghĩa / Trái nghĩa (Synonyms / Antonyms)",
      shortLabel: "Đồng nghĩa / Trái nghĩa",
      description: "Chọn từ gần nghĩa nhất (Closest) hoặc trái nghĩa nhất (Opposite) với từ gạch chân.",
    },
    {
      code: "VOCAB_COLLOCATION",
      label: "Dạng 7: Collocations (Cụm từ cố định: make/do/take...)",
      shortLabel: "Collocations (make/do/take)",
      description: "Kiểm tra các cặp từ tự nhiên hay đi cùng nhau trong tiếng Anh bản xứ.",
    },
    {
      code: "VOCAB_WORD_FAMILY",
      label: "Dạng 8: Họ từ (Word Family Transformation)",
      shortLabel: "Họ từ (Word Family)",
      description: "Biến đổi họ từ (Root, Noun, Verb, Adjective, Adverb) theo ngữ cảnh và chủ đề.",
    },
    {
      code: "VOCAB_MIXED",
      label: "Tổng hợp các dạng bài Từ vựng (Hỗn hợp)",
      shortLabel: "Tổng hợp Từ vựng",
      description: "Bộ bài tập kết hợp toàn diện cả 8 dạng bài học từ vựng theo phương pháp Spaced Repetition.",
    },
  ],
  SPEAKING: [
    {
      code: "SPEAKING_QA",
      label: "Phần 1: Hỏi - Đáp Phỏng Vấn (Speaking Q&A / Interview)",
      shortLabel: "Hỏi - Đáp Q&A",
      description: "Hệ thống hiển thị câu hỏi, học sinh thu âm trả lời. AI chấm Task Response, Fluency, Pronunciation & Grammar.",
    },
    {
      code: "SPEAKING_SHADOWING",
      label: "Phần 2: Luyện phát âm Nhại giọng (Shadowing Sentence Repeat)",
      shortLabel: "Shadowing luyện phát âm",
      description: "Nghe câu mẫu chuẩn ngữ điệu và đọc nhại lại theo nhịp điệu của người bản xứ.",
    },
  ],
  WRITING: [
    {
      code: "WRITING_PARAGRAPH",
      label: "Phần 1: Viết đoạn văn có hướng dẫn (Guided Paragraph Writing)",
      shortLabel: "Viết đoạn văn (Guided Paragraph)",
      description: "Viết đoạn văn 50-150 từ với câu hỏi gợi ý và bộ đếm từ trực tiếp.",
    },
    {
      code: "WRITING_SENTENCE",
      label: "Phần 2: Hoàn thành & Xây dựng câu (Sentence Completion A1-A2)",
      shortLabel: "Hoàn thành câu ngắn",
      description: "Viết câu hoàn chỉnh dựa trên từ khóa hoặc mẫu câu cho sẵn.",
    },
    {
      code: "WRITING_IELTS_TASK1",
      label: "Phần 3: IELTS Writing Task 1 - Miêu tả biểu đồ & số liệu (150 từ)",
      shortLabel: "IELTS Task 1 (Biểu đồ)",
      description: "Phân tích biểu đồ xu hướng, lập dàn ý và viết báo cáo học thuật.",
    },
    {
      code: "WRITING_IELTS_TASK2",
      label: "Phần 4: IELTS Writing Task 2 - Nghị luận xã hội (250 từ)",
      shortLabel: "IELTS Task 2 (Nghị luận)",
      description: "Áp dụng quy trình 5 bước Scaffolding: Phân tích đề -> Brainstorm -> Lập dàn ý -> Viết bài -> Chấm điểm AI.",
    },
  ],
};

export const LEVEL_TOPICS_MAP: Record<string, Record<string, string[]>> = {
  READING: {
    A1: [
      "Anna's Daily Routine and Her Job at a Small Café",
      "My Family and Our Weekend Activities at Home",
      "Shopping for Groceries at the Local Supermarket",
      "My School Day: Classes, Friends, and Teachers",
      "A Visit to the City Zoo and Favorite Animals",
      "Living in a Cozy Apartment in Downtown",
    ],
    A2: [
      "A Weekend Holiday in the Mountain Village",
      "Healthy Eating Habits and Traditional Recipes",
      "Famous Festivals and Celebrations Around the World",
      "Travel Guide: Visiting London on a Budget",
      "The Joy of Learning a New Musical Instrument",
      "How to Care for Pets and Adopt Animals Responsibly",
    ],
    B1: [
      "The Shift Toward Remote Work and Online Education",
      "Renewable Energy and Protecting Local Ecosystems",
      "The Impact of Social Media on Teenagers' Daily Habits",
      "Ecotourism and Preserving Endangered Wildlife",
      "The Evolution of Smart Cities and Public Transport",
      "Healthy Sleep Patterns and Mental Well-being",
    ],
    B2: [
      "Urban Biodiversity and Sustainable Architecture",
      "Artificial Intelligence: Automation vs Creative Industries",
      "Psychological Resiliency and Managing Modern Stress",
      "The Gig Economy and the Future of Employment",
      "Ocean Microplastics and Threats to Marine Ecosystems",
      "Consumer Psychology and the Rise of Fast Fashion",
    ],
    C1: [
      "Cognitive Effects of Bilingualism Across the Lifespan",
      "Quantum Computing Paradigm and Cryptographic Security",
      "Socioeconomic Stratification in Post-Industrial Megacities",
      "Biomimicry in Civil Engineering and Sustainable Structures",
      "The Philosophy of Consciousness and Machine Sentience",
      "Epistemic Trust and Media Consumption in the Digital Age",
    ],
    IELTS: [
      "Passage 1: The Domestication of Animals and Early Agriculture",
      "Passage 2: The Evolution of Human Language and Cognition",
      "Passage 3: Nanotechnology and Breakthroughs in Medicine",
      "Passage 1: History of Timekeeping and Mechanical Clocks",
      "Passage 2: Marine Biology - Coral Bleaching and Ocean Acidification",
      "Passage 3: Artificial Intelligence and Human Decision-Making Ethics",
    ],
  },
  LISTENING: {
    A1: [
      "Introducing Yourself and Meeting New Friends at University",
      "Ordering Breakfast and Drinks at a Local Café",
      "Asking for Directions to the Library and Bus Station",
      "Buying Train Tickets and Asking for Departure Times",
      "Daily Morning Schedule and House Chores Conversation",
      "Shopping for Clothes: Asking for Colors and Sizes",
    ],
    A2: [
      "Checking In at the Airport and Booking a Hotel Room",
      "A Phone Call to Schedule a Medical Doctor Appointment",
      "Planning a Weekend Camping Trip with Friends",
      "Inquiring About Gym Memberships and Fitness Classes",
      "Weather Forecast Discussion and Outdoor Weekend Plans",
      "Returning a Faulty Item to the Customer Service Counter",
    ],
    B1: [
      "Job Interview: Work Experience and Career Aspirations",
      "Two Colleagues Planning a Project Schedule and Milestones",
      "University Campus Tour and Course Registration Advice",
      "Podcast Discussion: Reducing Plastic Waste and Single-Use Items",
      "Customer Service Inquiry: Resolving Flight Delays and Refunds",
      "Workshop on Time Management and Productivity Strategies",
    ],
    B2: [
      "Academic Lecture on Renewable Energy and Climate Mitigation",
      "Business Conference Debate on AI Ethics and Automation",
      "Scientific Documentary on Neuroscience, Memory, and Sleep",
      "Panel Discussion on Public Healthcare Financing and Equity",
      "Interview with an Innovative Clean-Tech Startup Founder",
      "Radio Broadcast on the Economic Impacts of Global Supply Chains",
    ],
    C1: [
      "Symposium Keynote on Neurodegenerative Therapeutics and Gene Editing",
      "Global Economic Forum on Sovereign Debt Traps and Emerging Markets",
      "University Colloquium on Algorithmic Bias in Criminal Justice",
      "Interdisciplinary Debate on the Ethics of Synthetic Biology",
      "Scholarly Critique of Post-Modern Architecture and Urban Design",
      "Expert Analysis of Geopolitical Trade Treaties and Tariffs",
    ],
  },
};

export const getSuggestedTopics = (
  type: string,
  level: string,
  subCode?: string,
  readingPassage?: number,
  writingTask?: string
): string[] => {
  if (type === "WRITING") {
    if (subCode === "WRITING_WORD_ARRANGEMENT") {
      return [
        `Sắp xếp từ (${level}): Trật tự câu khẳng định và phủ định cơ bản (S + V + O)`,
        `Sắp xếp từ (${level}): Trật tự tính từ miêu tả và trạng từ chỉ tần suất (always, usually)`,
        `Sắp xếp từ (${level}): Đảo ngữ trợ động từ trong câu hỏi Wh- và Yes/No`,
        `Sắp xếp từ (${level}): Cấu trúc câu điều kiện và mệnh đề quan hệ (who, which, that)`,
        `Sắp xếp từ (${level}): Cụm giới từ chỉ thời gian và nơi chốn trong câu`,
      ];
    }
    if (subCode === "WRITING_SENTENCE") {
      return [
        `Hoàn thành câu (${level}): Nối câu bằng liên từ (Because, Although, In order to)`,
        `Hoàn thành câu (${level}): Biến đổi câu Chủ động sang Bị động (Active to Passive)`,
        `Hoàn thành câu (${level}): Viết lại câu với Câu điều kiện loại 1 & 2`,
        `Hoàn thành câu (${level}): Câu gián tiếp tường thuật lời nói và yêu cầu lịch sự`,
        `Hoàn thành câu (${level}): Sử dụng Gerund và To-Infinitive chính xác theo động từ`,
      ];
    }
    if (subCode === "WRITING_KEYWORD") {
      return [
        `Viết câu từ từ khóa (${level}): Thói quen hàng ngày và sở thích cá nhân`,
        `Viết câu từ từ khóa (${level}): Kỳ nghỉ cuối tuần và trải nghiệm du lịch đáng nhớ`,
        `Viết câu từ từ khóa (${level}): Kế hoạch tương lai và mục tiêu học tập`,
        `Viết câu từ từ khóa (${level}): Công nghệ hiện đại và giao tiếp trực tuyến`,
        `Viết câu từ từ khóa (${level}): Công việc, nghề nghiệp và trách nhiệm tại nơi làm việc`,
      ];
    }
    if (subCode === "WRITING_OPINION") {
      return [
        `Opinion (${level}): Should students have part-time jobs while studying? (100–150 words)`,
        `Opinion (${level}): Is social media beneficial or harmful for teenagers? (100–150 words)`,
        `Opinion (${level}): Should public transportation be free for all residents? (100–150 words)`,
        `Opinion (${level}): Does online learning offer higher efficiency than classrooms? (100–150 words)`,
      ];
    }
    if (subCode === "WRITING_ADV_DISADV") {
      return [
        `Adv-Disadv (${level}): Pros and cons of living in a crowded megacity (100–150 words)`,
        `Adv-Disadv (${level}): Advantages and disadvantages of working remotely (100–150 words)`,
        `Adv-Disadv (${level}): Benefits and drawbacks of artificial intelligence in schools (100–150 words)`,
        `Adv-Disadv (${level}): Advantages and disadvantages of tourism on local culture (100–150 words)`,
      ];
    }
    if (subCode === "WRITING_CAUSE_EFFECT") {
      return [
        `Cause-Effect (${level}): Causes and effects of environmental pollution in cities (100–150 words)`,
        `Cause-Effect (${level}): The causes and impacts of stress among university students (100–150 words)`,
        `Cause-Effect (${level}): Why fast food consumption is rising and its health impacts (100–150 words)`,
        `Cause-Effect (${level}): Digital screen addiction causes and sleep degradation (100–150 words)`,
      ];
    }
    if (subCode === "WRITING_PROBLEM_SOLUTION") {
      return [
        `Problem-Solution (${level}): Traffic congestion during rush hours and transit solutions (100–150 words)`,
        `Problem-Solution (${level}): Plastic waste pollution and community recycling initiatives (100–150 words)`,
        `Problem-Solution (${level}): Sedentary lifestyle among desk workers and fitness remedies (100–150 words)`,
        `Problem-Solution (${level}): Youth unemployment in urban centers and vocational training (100–150 words)`,
      ];
    }
    if (subCode === "WRITING_IELTS_TASK1" || writingTask === "TASK_1") {
      return [
        "Task 1: Line Graph - Global Renewable Energy Share (2000-2025)",
        "Task 1: Bar Chart - Consumer Spending on Tech Gadgets across 5 Countries",
        "Task 1: Pie Charts - Water Usage by Sector in Australia",
        "Task 1: Table - International Tourist Arrivals and Tourism Revenue",
        "Task 1: Process Diagram - Water Purification and Desalination Cycle",
        "Task 1: Map Comparison - City Center Development (2000 vs Present)",
      ];
    }
    if (subCode === "WRITING_IELTS_TASK2" || writingTask === "TASK_2") {
      return [
        "Task 2 Opinion: Some argue higher education should be free for all citizens",
        "Task 2 Discussion: Should remote work permanently replace traditional offices?",
        "Task 2 Problem-Solution: Overpopulation and traffic congestion in megacities",
        "Task 2 Advantages-Disadvantages: Growing dependence on artificial intelligence",
        "Task 2 Double Question: Why are traditional crafts disappearing and how to preserve them?",
      ];
    }
  }

  if (type === "SPEAKING" && subCode === "SPEAKING_SHADOWING") {
    return [
      `Shadowing (${level}): Linking sounds and reduction in daily conversations`,
      `Shadowing (${level}): Connected speech and intonation in workplace dialogues`,
      `Shadowing (${level}): Sentence stress and expressing opinions naturally`,
      `Shadowing (${level}): Weak forms of auxiliary verbs and natural rhythm`,
      `Shadowing (${level}): Fluent storytelling, pacing and natural breath groups`,
    ];
  }

  if (type === "VOCABULARY") {
    if (subCode === "VOCAB_COLLOCATION") {
      return [
        `Collocations (${level}): High-frequency phrases with Make, Do, Take, Have`,
        `Collocations (${level}): Academic collocations for analysis and arguments`,
        `Collocations (${level}): Business and workplace communication expressions`,
        `Collocations (${level}): Environment, sustainability and nature pairings`,
        `Collocations (${level}): Health, lifestyle, emotion and wellness pairings`,
      ];
    }
    if (subCode === "VOCAB_WORD_FORM" || subCode === "VOCAB_WORD_FAMILY") {
      return [
        `Word Forms (${level}): Noun, Verb, Adjective and Adverb derivations`,
        `Word Forms (${level}): High-frequency academic roots, prefixes and suffixes`,
        `Word Forms (${level}): Contextual word transformation in sentence gaps`,
        `Word Forms (${level}): Technology, science and environment word families`,
      ];
    }
    if (subCode === "VOCAB_SYNONYM_ANTONYM") {
      return [
        `Synonyms & Antonyms (${level}): Essential communicative vocabulary pairs`,
        `Synonyms & Antonyms (${level}): Academic adjectives and descriptive adverbs`,
        `Synonyms & Antonyms (${level}): Workplace, technology and environmental terms`,
        `Synonyms & Antonyms (${level}): Emotions, personality traits and character descriptions`,
      ];
    }
    if (subCode === "VOCAB_DICTATION" || subCode === "VOCAB_LISTEN_CHOOSE") {
      return [
        `Phonetics & Dictation (${level}): Daily routines, home objects and family`,
        `Phonetics & Dictation (${level}): Travel, directions, airports and city places`,
        `Phonetics & Dictation (${level}): Academic lecture vocabulary and high-frequency terms`,
        `Phonetics & Dictation (${level}): Commonly confused minimal pairs and silent letters`,
      ];
    }
  }

  if (type === "GRAMMAR") {
    if (subCode === "GRAMMAR_VERB_CONJUGATION") {
      return [
        `Verb Conjugation (${level}): Thì Hiện tại đơn (Present Simple Tense) - Thói quen, chân lý & ngôi thứ ba số ít`,
        `Verb Conjugation (${level}): Thì Quá khứ đơn (Past Simple Tense) - Kể chuyện & Động từ bất quy tắc`,
        `Verb Conjugation (${level}): Thì Hiện tại tiếp diễn (Present Continuous) - Hành động đang diễn ra`,
        `Verb Conjugation (${level}): Thì Hiện tại hoàn thành (Present Perfect) với Since & For`,
        `Verb Conjugation (${level}): Thì Tương lai đơn & Be going to - Kế hoạch & Dự đoán`,
        `Verb Conjugation (${level}): Câu điều kiện loại 1 & loại 2 (Conditionals Type 1 & 2)`,
        `Verb Conjugation (${level}): Thể bị động (Passive Voice) ở các thì cơ bản`,
      ];
    }
    if (subCode === "GRAMMAR_MULTIPLE_CHOICE") {
      return [
        `Multiple Choice (${level}): Trắc nghiệm Thì Hiện tại đơn & Trạng từ tần suất (always, usually, never)`,
        `Multiple Choice (${level}): Trắc nghiệm Thì Quá khứ đơn & Động từ có quy tắc / Bất quy tắc`,
        `Multiple Choice (${level}): Trắc nghiệm Giới từ chỉ thời gian & nơi chốn (in, on, at)`,
        `Multiple Choice (${level}): Trắc nghiệm Mạo từ (A, An, The) & Danh từ đếm được / Không đếm được`,
        `Multiple Choice (${level}): Trắc nghiệm Động từ khiếm khuyết (Can, Could, Must, Should)`,
      ];
    }
    if (subCode === "GRAMMAR_WORD_ARRANGEMENT" || subCode === "GRAMMAR_UNSCRAMBLE") {
      return [
        `Sắp xếp từ (${level}): Cấu trúc câu khẳng định & phủ định Thì Hiện tại đơn (S + V + O)`,
        `Sắp xếp từ (${level}): Trật tự trạng từ chỉ tần suất (always, usually) và trạng từ thời gian`,
        `Sắp xếp từ (${level}): Câu nghi vấn Wh- questions & Yes/No với trợ động từ do/does`,
        `Sắp xếp từ (${level}): Cụm giới từ chỉ địa điểm & nơi chốn trong câu`,
      ];
    }
    if (subCode === "GRAMMAR_FILL_IN_BLANK") {
      return [
        `Điền từ (${level}): Giới từ chỉ vị trí và thời gian (in, on, at, under, between)`,
        `Điền từ (${level}): Đại từ nhân xưng, tân ngữ và tính từ sở hữu (I/me/my, they/them/their)`,
        `Điền từ (${level}): Trợ động từ Do/Does và Động từ To Be (am/is/are)`,
        `Điền từ (${level}): Lượng từ (much, many, a lot of, some, any, few, little)`,
      ];
    }
    if (subCode === "GRAMMAR_ERROR_CORRECTION") {
      return [
        `Sửa lỗi sai (${level}): Lỗi hòa hợp chủ vị (Subject-Verb Agreement) ở Thì Hiện tại đơn`,
        `Sửa lỗi sai (${level}): Lỗi dùng sai trợ động từ và dạng nguyên mẫu của động từ`,
        `Sửa lỗi sai (${level}): Lỗi chia thì Quá khứ đơn và động từ bất quy tắc`,
        `Sửa lỗi sai (${level}): Lỗi dùng sai giới từ trong các cụm cố định`,
      ];
    }
    if (subCode === "GRAMMAR_TRANSFORMATION") {
      return [
        `Transformation (${level}): Active sang Passive voice (Chủ động sang Bị động)`,
        `Transformation (${level}): Direct sang Reported speech (Trực tiếp sang Gián tiếp)`,
        `Transformation (${level}): Câu điều kiện loại 1 & loại 2`,
        `Transformation (${level}): So sánh hơn & So sánh nhất (Comparatives & Superlatives)`,
      ];
    }
  }

  if (type === "LISTENING") {
    if (subCode === "LISTENING_DIALOGUE") {
      return [
        `Dialogue (${level}): Two friends discussing weekend plans and cinema tickets`,
        `Dialogue (${level}): Customer and receptionist arranging hotel check-in`,
        `Dialogue (${level}): Colleagues debating project priorities and meeting deadlines`,
        `Dialogue (${level}): Doctor and patient consultation about health symptoms`,
      ];
    }
    if (subCode === "LISTENING_FILL") {
      return [
        `Gap-fill Dictation (${level}): Flight announcement and gate change notice`,
        `Gap-fill Dictation (${level}): Weather forecast and travel advisory warning`,
        `Gap-fill Dictation (${level}): Radio news summary on renewable green tech`,
        `Gap-fill Dictation (${level}): University campus orientation and library rules`,
      ];
    }
  }

  const typeMap = LEVEL_TOPICS_MAP[type] || LEVEL_TOPICS_MAP.READING;
  const topicsForLevel = typeMap[level] || typeMap["B1"] || [];

  if (type === "READING" && level === "IELTS" && readingPassage) {
    const prefix = `Passage ${readingPassage}:`;
    const matching = topicsForLevel.filter((t) => t.startsWith(prefix));
    if (matching.length > 0) {
      return [...matching, ...topicsForLevel.filter((t) => !t.startsWith(prefix))];
    }
  }

  return topicsForLevel;
};

export interface QuestionFormatItem {
  code: string;
  label: string;
  description: string;
}

export const getLevelQuestionFormats = (
  skill: string,
  level: string
): QuestionFormatItem[] => {
  const isBeginner = level === "A1" || level === "A2";
  const isIntermediate = level === "B1" || level === "B2";

  if (skill === "WRITING") {
    if (isBeginner) {
      return [
        {
          code: "WRITING_WORD_ARRANGEMENT",
          label: "1. Sắp xếp từ thành câu (Word Order)",
          description: "Sắp xếp các từ xáo trộn thành câu hoàn chỉnh đúng ngữ pháp (A1-A2)",
        },
        {
          code: "WRITING_SENTENCE",
          label: "2. Hoàn thành câu ngắn (Sentence Completion)",
          description: "Điền và hoàn thiện câu dựa trên từ khóa gợi ý",
        },
        {
          code: "WRITING_KEYWORD",
          label: "3. Viết câu từ từ khóa (Keyword-to-Sentence)",
          description: "Tạo câu có nghĩa hoàn chỉnh từ danh sách các từ khóa",
        },
        {
          code: "WRITING_PARAGRAPH",
          label: "4. Đoạn văn ngắn 30–80 từ (Guided Paragraph)",
          description: "Viết đoạn văn 30–80 từ về bản thân, gia đình, sở thích hàng ngày",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "WRITING_OPINION",
          label: "1. Opinion Paragraph (Đoạn văn quan điểm)",
          description: "Đoạn văn 100–150 từ nêu quan điểm cá nhân với lý lẽ và ví dụ",
        },
        {
          code: "WRITING_ADV_DISADV",
          label: "2. Advantages & Disadvantages (Lợi & Hại)",
          description: "Phân tích hai mặt ưu điểm và nhược điểm của một xu hướng",
        },
        {
          code: "WRITING_CAUSE_EFFECT",
          label: "3. Cause & Effect (Nguyên nhân & Hệ quả)",
          description: "Giải thích nguyên nhân và hệ quả của một hiện tượng xã hội",
        },
        {
          code: "WRITING_PROBLEM_SOLUTION",
          label: "4. Problem & Solution (Vấn đề & Giải pháp)",
          description: "Phân tích thực trạng vấn đề và đề xuất hướng giải quyết",
        },
        {
          code: "WRITING_PARAGRAPH",
          label: "5. Guided Academic Paragraph (Đoạn văn học thuật)",
          description: "Đoạn văn học thuật 120–180 từ với các luận điểm logic",
        },
      ];
    }
    return [
      {
        code: "WRITING_IELTS_TASK1",
        label: "IELTS Task 1: Miêu tả biểu đồ & số liệu (150 từ)",
        description: "Báo cáo số liệu khách quan theo biểu đồ Line, Bar, Pie, Table, Process, Map",
      },
      {
        code: "WRITING_IELTS_TASK2",
        label: "IELTS Task 2: Bài luận nghị luận xã hội (250 từ)",
        description: "Bài luận học thuật 250 từ chấm theo 4 tiêu chí TR, CC, LR, GRA",
      },
      {
        code: "WRITING_PARAGRAPH",
        label: "Discursive Academic Essay (Bài luận phản biện C1)",
        description: "Luận phản biện đa chiều về triết học, khoa học, chính sách xã hội",
      },
    ];
  }

  if (skill === "READING") {
    if (isBeginner) {
      return [
        {
          code: "READING_FILL_BLANK",
          label: "1. Điền từ vào ô trống (Fact Completion)",
          description: "Trích xuất thông tin trực tiếp từ bài đọc để điền từ",
        },
        {
          code: "READING_SHORT_ANSWER",
          label: "2. Trả lời câu hỏi ngắn (Short Answer)",
          description: "Trả lời ngắn gọn dữ kiện cụ thể từ bài đọc",
        },
        {
          code: "READING_MULTIPLE_CHOICE",
          label: "3. Trắc nghiệm 4 lựa chọn (Multiple Choice)",
          description: "Chọn 1 trong 4 đáp án đúng về chi tiết trong bài đọc",
        },
        {
          code: "READING_TRUE_FALSE",
          label: "4. Đúng / Sai (True / False)",
          description: "Xác thực tính đúng sai của thông tin so với bài đọc",
        },
        {
          code: "READING_MATCHING",
          label: "5. Ghép nối thông tin (Matching)",
          description: "Nối nhân vật, thời gian, sự kiện tương ứng",
        },
        {
          code: "READING_PARAPHRASE",
          label: "6. Đoán nghĩa từ theo ngữ cảnh (Vocab in Context)",
          description: "Đoán nghĩa từ vựng hoặc đại từ chỉ định trong ngữ cảnh",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "READING_PARAPHRASE",
          label: "1. Paraphrasing & Synonyms (Từ đồng nghĩa biến thể)",
          description: "Nhận diện cách diễn đạt tương đương và tránh bẫy từ vựng",
        },
        {
          code: "READING_TRUE_FALSE",
          label: "2. True / False / Not Given",
          description: "Đánh giá dữ kiện khẳng định, phủ định hoặc không được đề cập",
        },
        {
          code: "READING_MATCHING",
          label: "3. Matching Headings (Ghép tiêu đề đoạn)",
          description: "Chọn tiêu đề khái quát chính xác cho từng đoạn văn",
        },
        {
          code: "READING_FILL_BLANK",
          label: "4. Summary Completion (Tóm tắt điền từ)",
          description: "Điền từ vào đoạn tóm tắt bài đọc học thuật",
        },
        {
          code: "READING_MULTIPLE_CHOICE",
          label: "5. Trắc nghiệm suy luận & Bẫy distractors",
          description: "Câu hỏi suy luận ngầm (Inference) và thái độ tác giả",
        },
      ];
    }
    return [
      {
        code: "READING_TRUE_FALSE",
        label: "1. True / False / Not Given (Học thuật)",
        description: "Đánh giá dữ kiện học thuật chuẩn đề thi IELTS",
      },
      {
        code: "READING_YES_NO",
        label: "2. Yes / No / Not Given (Quan điểm tác giả)",
        description: "Xác định thái độ, quan điểm và luận điểm của tác giả",
      },
      {
        code: "READING_MATCHING",
        label: "3. Matching Headings & Features",
        description: "Nối tiêu đề đoạn văn và ghép nối tính năng nghiên cứu",
      },
      {
        code: "READING_FILL_BLANK",
        label: "4. Flow-chart & Summary Completion",
        description: "Hoàn thành quy trình hoặc tóm tắt sơ đồ học thuật",
      },
      {
        code: "READING_MULTIPLE_CHOICE",
        label: "5. Academic Multiple Choice (Trắc nghiệm học thuật)",
        description: "Trắc nghiệm 4 lựa chọn với bẫy học thuật phân tầng cao",
      },
    ];
  }

  if (skill === "GRAMMAR") {
    if (isBeginner) {
      return [
        {
          code: "GRAMMAR_MULTIPLE_CHOICE",
          label: "1. Trắc nghiệm quy tắc thì (Multiple Choice)",
          description: "4 lựa chọn thì hiện tại/quá khứ đơn, giới từ, mạo từ",
        },
        {
          code: "GRAMMAR_VERB_CONJUGATION",
          label: "2. Chia động từ theo thì (Verb Conjugation)",
          description: "Chia động từ trong ngoặc theo ngữ cảnh câu chuyện",
        },
        {
          code: "GRAMMAR_WORD_ARRANGEMENT",
          label: "3. Sắp xếp từ thành câu (Word Unscramble)",
          description: "Sắp xếp các từ rời rạc thành câu đúng cấu trúc",
        },
        {
          code: "GRAMMAR_FILL_IN_BLANK",
          label: "4. Điền giới từ & đại từ vào ô trống",
          description: "Điền in/on/at, đại từ, tính từ sở hữu vào chỗ trống",
        },
        {
          code: "GRAMMAR_ERROR_CORRECTION",
          label: "5. Tìm và sửa lỗi sai cơ bản",
          description: "Phát hiện 1 lỗi sai ngữ pháp trong câu đơn và sửa lại",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "GRAMMAR_ERROR_CORRECTION",
          label: "1. Chữa lỗi sai câu phức (Error Identification)",
          description: "Sửa lỗi hòa hợp chủ vị, thì hoàn thành, mệnh đề quan hệ",
        },
        {
          code: "GRAMMAR_VERB_CONJUGATION",
          label: "2. Chia động từ nâng cao (Passive & Conditionals)",
          description: "Chia động từ ở thể bị động, câu điều kiện loại 1-2-3",
        },
        {
          code: "GRAMMAR_TRANSFORMATION",
          label: "3. Viết lại câu giữ nguyên nghĩa (Transformation)",
          description: "Chuyển đổi chủ động - bị động, trực tiếp - gián tiếp",
        },
        {
          code: "GRAMMAR_MULTIPLE_CHOICE",
          label: "4. Trắc nghiệm câu phức & liên từ",
          description: "Kiểm tra mệnh đề quan hệ, liên từ nhượng bộ, điều kiện",
        },
        {
          code: "GRAMMAR_WORD_ARRANGEMENT",
          label: "5. Sắp xếp trật tự mệnh đề phức",
          description: "Sắp xếp các mệnh đề và trạng từ thành câu phức hoàn chỉnh",
        },
      ];
    }
    return [
      {
        code: "GRAMMAR_TRANSFORMATION",
        label: "1. Biến đổi cấu trúc học thuật (Cleft, Passive)",
        description: "Viết lại câu với câu chẻ, bị động khách quan, mệnh đề phân từ",
      },
      {
        code: "GRAMMAR_ERROR_CORRECTION",
        label: "2. Chữa lỗi văn phong học thuật & Collocations",
        description: "Phát hiện lỗi ngữ pháp học thuật tinh vi và tính mạch lạc",
      },
      {
        code: "GRAMMAR_INVERSION",
        label: "3. Đảo ngữ với phó từ phủ định (Negative Inversion)",
        description: "Cấu trúc đảo ngữ: Not only, Seldom, Hardly, Under no circumstances",
      },
      {
        code: "GRAMMAR_NOMINALISATION",
        label: "4. Danh từ hóa & câu cô đọng (Nominalisation)",
        description: "Biến đổi động từ/tính từ thành cụm danh từ học thuật",
      },
      {
        code: "GRAMMAR_MULTIPLE_CHOICE",
        label: "5. Trắc nghiệm cấu trúc Band 8.0+",
        description: "Điều kiện hỗn hợp (Mixed conditionals), giả định thức (Subjunctive)",
      },
    ];
  }

  if (skill === "VOCABULARY") {
    if (isBeginner) {
      return [
        {
          code: "VOCAB_LISTEN_CHOOSE",
          label: "1. Nghe & Chọn từ (Listen & Choose Word)",
          description: "Hệ thống phát âm từ tiếng Anh, học sinh nghe và chọn 1 trong 4 từ",
        },
        {
          code: "VOCAB_DICTATION",
          label: "2. Nghe chính tả điền từ (Listen & Type Word)",
          description: "Hệ thống phát âm từ tiếng Anh, học sinh nghe và gõ chính xác từ",
        },
        {
          code: "VOCAB_MEANING_TO_WORD",
          label: "3. Định nghĩa -> Từ (Meaning to Word)",
          description: "Đọc định nghĩa hoặc nghĩa tiếng Việt và nhập từ vựng tương ứng",
        },
        {
          code: "VOCAB_MATCHING",
          label: "4. Nối từ với nghĩa (Word-Definition Matching)",
          description: "Ghép các cặp từ vựng với định nghĩa hoặc nghĩa tiếng Việt",
        },
        {
          code: "VOCAB_WORD_FORM",
          label: "5. Dạng từ cơ bản trong câu (Word Form)",
          description: "Điền dạng danh từ / tính từ cơ bản vào chỗ trống",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "VOCAB_WORD_FORM",
          label: "1. Dạng từ trong câu (Word Form in Context)",
          description: "Biến đổi Danh từ / Động từ / Tính từ / Trạng từ theo ngữ cảnh",
        },
        {
          code: "VOCAB_COLLOCATION",
          label: "2. Collocations (make/do/take/have...)",
          description: "Kiểm tra các cặp từ tự nhiên hay đi cùng nhau trong tiếng Anh",
        },
        {
          code: "VOCAB_SYNONYM_ANTONYM",
          label: "3. Đồng nghĩa / Trái nghĩa (Synonyms / Antonyms)",
          description: "Chọn từ gần nghĩa nhất (Closest) hoặc trái nghĩa nhất (Opposite)",
        },
        {
          code: "VOCAB_WORD_FAMILY",
          label: "4. Họ từ (Word Family Transformation)",
          description: "Biến đổi họ từ gốc, tiền tố (un-, dis-) và hậu tố (-tion, -able)",
        },
        {
          code: "VOCAB_MEANING_TO_WORD",
          label: "5. Định nghĩa học thuật -> Từ (Definition)",
          description: "Đọc định nghĩa học thuật chuyên sâu và suy luận từ vựng",
        },
        {
          code: "VOCAB_DICTATION",
          label: "6. Nghe chính tả từ vựng học thuật",
          description: "Nghe phát âm từ vựng học thuật kèm phiên âm IPA và gõ từ",
        },
      ];
    }
    return [
      {
        code: "VOCAB_COLLOCATION",
        label: "1. Collocations học thuật Band 7.5+",
        description: "Cụm từ học thuật chuyên sâu dùng trong bài luận và nghiên cứu",
      },
      {
        code: "VOCAB_SYNONYM_ANTONYM",
        label: "2. Nuance Synonyms & Paraphrasing",
        description: "Phân biệt sắc thái nghĩa tinh tế giữa các từ đồng nghĩa học thuật",
      },
      {
        code: "VOCAB_WORD_FAMILY",
        label: "3. Biến đổi họ từ nâng cao (Root & Affixes)",
        description: "Biến đổi họ từ với các gốc từ Hy Lạp / Latinh học thuật",
      },
      {
        code: "VOCAB_WORD_FORM",
        label: "4. Dạng từ học thuật trong báo cáo / bài luận",
        description: "Điền dạng từ chính xác trong văn bản nghiên cứu chuyên ngành",
      },
      {
        code: "VOCAB_MEANING_TO_WORD",
        label: "5. Định nghĩa học thuật chuyên sâu -> Từ",
        description: "Nhận diện thuật ngữ khoa học và triết học qua định nghĩa",
      },
    ];
  }

  if (skill === "LISTENING") {
    if (isBeginner) {
      return [
        {
          code: "LISTENING_FILL",
          label: "1. Nghe điền từ chi tiết đơn giản (Gap-fill Dictation)",
          description: "Nghe đoạn thông báo/đối thoại và điền từ vào chỗ trống",
        },
        {
          code: "LISTENING_DIALOGUE",
          label: "2. Nghe hội thoại tình huống đời sống (Dialogue Q&A)",
          description: "Nghe cuộc trò chuyện 2 người ở quán ăn, khách sạn, ga tàu",
        },
        {
          code: "LISTENING_MULTIPLE_CHOICE",
          label: "3. Trắc nghiệm nghe hiểu thông tin trực tiếp",
          description: "Chọn phương án đúng về các chi tiết nghe được",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "LISTENING_DIALOGUE",
          label: "1. Nghe hội thoại đa lượt (Multi-turn Dialogue)",
          description: "Cuộc thảo luận công việc, phỏng vấn, lập kế hoạch dự án",
        },
        {
          code: "LISTENING_FILL",
          label: "2. Nghe tóm tắt điền từ (Summary Gap-fill)",
          description: "Nghe bài chia sẻ và hoàn thành bản tóm tắt nội dung chính",
        },
        {
          code: "LISTENING_MULTIPLE_CHOICE",
          label: "3. Trắc nghiệm nghe hiểu ý chính & bẫy distractors",
          description: "Trắc nghiệm 4 đáp án với các bẫy nghe thường gặp",
        },
      ];
    }
    return [
      {
        code: "LISTENING_FILL",
        label: "1. IELTS Section 1 & 4 (Form/Note/Lecture Completion)",
        description: "Hoàn thành mẫu đơn và ghi chú bài giảng khoa học (No more than 2 words)",
      },
      {
        code: "LISTENING_MULTIPLE_CHOICE",
        label: "2. IELTS Section 2 & 3 (Multiple Choice & Matching)",
        description: "Trắc nghiệm phân tích quan điểm nhiều diễn giả và ghép thông tin",
      },
      {
        code: "LISTENING_DIALOGUE",
        label: "3. Academic Tutorial Discussion",
        description: "Thảo luận giữa giáo sư và sinh viên về phương pháp nghiên cứu",
      },
    ];
  }

  if (skill === "SPEAKING") {
    if (isBeginner) {
      return [
        {
          code: "SPEAKING_SHADOWING",
          label: "1. Luyện phát âm nhại câu (Shadowing Repetition)",
          description: "Nghe câu mẫu chuẩn và đọc nhại lại theo ngữ điệu bản xứ",
        },
        {
          code: "SPEAKING_QA",
          label: "2. Hỏi - Đáp giao tiếp cơ bản (Basic Q&A)",
          description: "Thu âm trả lời câu hỏi về tên, tuổi, quê quán, thói quen",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "SPEAKING_SHADOWING",
          label: "1. Shadowing ngữ điệu tự nhiên & Nối âm",
          description: "Luyện nối âm (linking sounds), trọng âm câu và nhịp điệu bản ngữ tự nhiên",
        },
        {
          code: "SPEAKING_QA",
          label: "2. Phỏng vấn giao tiếp & IELTS Speaking Part 1/2",
          description: "Trả lời phỏng vấn theo chủ đề và miêu tả trải nghiệm (Cue card)",
        },
      ];
    }
    return [
      {
        code: "SPEAKING_SHADOWING",
        label: "1. Shadowing bài nói học thuật & Độ lưu loát",
        description: "Luyện phát âm diễn cảm, ngắt nghỉ chuẩn xác theo cụm ý (thought groups)",
      },
      {
        code: "SPEAKING_QA",
        label: "2. IELTS Speaking Part 2 & Part 3 (Phản biện chiều sâu)",
        description: "Thuyết trình chủ đề học thuật và thảo luận các vấn đề xã hội sâu sắc",
      },
    ];
  }

  return [];
};

export const QUESTION_TYPE_LABELS: Record<QuestionDraft["questionType"], string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "True / False / Not Given",
  FILL_IN_BLANK: "Điền từ / Hoàn thành câu",
  MATCHING: "Ghép cặp từ vựng (Matching)",
  AUDIO_RESPONSE: "Nói (Audio Response)",
  ESSAY: "Tự luận / Viết",
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  LISTENING: "Nghe (Listening)",
  SPEAKING: "Nói (Speaking)",
  READING: "Đọc (Reading)",
  WRITING: "Viết (Writing)",
  VOCABULARY: "Từ vựng (Vocabulary)",
  GRAMMAR: "Ngữ pháp (Grammar)",
};

export const SKILL_BADGE_CLASS: Record<SkillKey, string> = {
  LISTENING: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SPEAKING: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  READING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  WRITING: "bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-500/30",
  VOCABULARY: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  GRAMMAR: "bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-600/30",
};
