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
      label: "Phần 1: Nghe trắc nghiệm",
      shortLabel: "Nghe trắc nghiệm",
      description: "Nghe audio và chọn 1 trong 4 đáp án.",
    },
    {
      code: "LISTENING_FILL",
      label: "Phần 2: Nghe điền từ",
      shortLabel: "Nghe điền từ",
      description: "Nghe và điền từ khóa hoặc số liệu.",
    },
    {
      code: "LISTENING_DIALOGUE",
      label: "Phần 3: Nghe hội thoại",
      shortLabel: "Nghe hội thoại",
      description: "Nghe đối thoại 2 người và trả lời câu hỏi.",
    },
    {
      code: "LISTENING_MIXED",
      label: "Tổng hợp Nghe",
      shortLabel: "Tổng hợp Nghe",
      description: "Kết hợp trắc nghiệm và điền từ.",
    },
  ],
  GRAMMAR: [
    {
      code: "GRAMMAR_VERB_CONJUGATION",
      label: "Phần 1: Chia động từ",
      shortLabel: "Chia động từ",
      description: "Chia động từ trong ngoặc theo thì.",
    },
    {
      code: "GRAMMAR_WORD_ARRANGEMENT",
      label: "Phần 2: Sắp xếp từ",
      shortLabel: "Sắp xếp từ",
      description: "Ghép các từ xáo trộn thành câu hoàn chỉnh.",
    },
    {
      code: "GRAMMAR_ERROR_CORRECTION",
      label: "Phần 3: Sửa lỗi sai",
      shortLabel: "Sửa lỗi sai",
      description: "Tìm và sửa 1 lỗi ngữ pháp trong câu.",
    },
    {
      code: "GRAMMAR_TRANSFORMATION",
      label: "Phần 4: Viết lại câu",
      shortLabel: "Viết lại câu",
      description: "Viết lại câu giữ nguyên nghĩa (bị động, điều kiện, đảo ngữ).",
    },
    {
      code: "GRAMMAR_MULTIPLE_CHOICE",
      label: "Phần 5: Trắc nghiệm ngữ pháp",
      shortLabel: "Trắc nghiệm ngữ pháp",
      description: "4 phương án về thì, giới từ, mạo từ, liên từ.",
    },
    {
      code: "GRAMMAR_MIXED",
      label: "Tổng hợp Ngữ pháp",
      shortLabel: "Tổng hợp Ngữ pháp",
      description: "Kết hợp nhiều dạng ngữ pháp.",
    },
  ],
  READING: [
    {
      code: "READING_FILL_BLANK",
      label: "Phần 1: Điền từ theo bài đọc",
      shortLabel: "Điền từ bài đọc",
      description: "Lấy dữ kiện từ bài đọc điền chỗ trống.",
    },
    {
      code: "READING_TRUE_FALSE",
      label: "Phần 2: True / False / Not Given",
      shortLabel: "True / False / NG",
      description: "Xác định nhận định đúng, sai hoặc không có trong bài.",
    },
    {
      code: "READING_MULTIPLE_CHOICE",
      label: "Phần 3: Trắc nghiệm đọc hiểu",
      shortLabel: "Trắc nghiệm đọc hiểu",
      description: "4 lựa chọn về chi tiết, ý chính và thái độ.",
    },
    {
      code: "READING_PARAPHRASE",
      label: "Phần 4: Paraphrase & Suy luận",
      shortLabel: "Paraphrase & Suy luận",
      description: "Tìm từ đồng nghĩa biến thể và suy luận.",
    },
    {
      code: "READING_MIXED",
      label: "Tổng hợp Đọc hiểu",
      shortLabel: "Tổng hợp Đọc hiểu",
      description: "Bài đọc kèm nhiều dạng câu hỏi.",
    },
  ],
  VOCABULARY: [
    {
      code: "VOCAB_LISTEN_CHOOSE",
      label: "Dạng 1: Nghe & Chọn từ",
      shortLabel: "Nghe & Chọn từ",
      description: "Nghe phát âm và chọn 1 trong 4 từ.",
    },
    {
      code: "VOCAB_DICTATION",
      label: "Dạng 2: Nghe chính tả",
      shortLabel: "Nghe chính tả",
      description: "Nghe phát âm và gõ đúng từ.",
    },
    {
      code: "VOCAB_MEANING_TO_WORD",
      label: "Dạng 3: Định nghĩa -> Từ",
      shortLabel: "Định nghĩa -> Từ",
      description: "Đọc nghĩa và nhập từ tiếng Anh.",
    },
    {
      code: "VOCAB_WORD_FORM",
      label: "Dạng 4: Word Form",
      shortLabel: "Word Form",
      description: "Điền đúng dạng N / V / Adj / Adv.",
    },
    {
      code: "VOCAB_MATCHING",
      label: "Dạng 5: Ghép từ - nghĩa",
      shortLabel: "Ghép từ - nghĩa",
      description: "Ghép từ vựng với nghĩa tương ứng.",
    },
    {
      code: "VOCAB_SYNONYM_ANTONYM",
      label: "Dạng 6: Đồng / Trái nghĩa",
      shortLabel: "Đồng / Trái nghĩa",
      description: "Chọn từ gần nghĩa (Closest) hoặc trái nghĩa (Opposite).",
    },
    {
      code: "VOCAB_COLLOCATION",
      label: "Dạng 7: Collocations",
      shortLabel: "Collocations",
      description: "Cụm từ cố định (make/do/take...).",
    },
    {
      code: "VOCAB_WORD_FAMILY",
      label: "Dạng 8: Họ từ (Word Family)",
      shortLabel: "Họ từ (Word Family)",
      description: "Biến đổi họ từ theo ngữ cảnh.",
    },
    {
      code: "VOCAB_MIXED",
      label: "Tổng hợp Từ vựng",
      shortLabel: "Tổng hợp Từ vựng",
      description: "Kết hợp cả 8 dạng bài từ vựng.",
    },
  ],
  SPEAKING: [
    {
      code: "SPEAKING_QA",
      label: "Phần 1: Hỏi - Đáp (Part 1 / Q&A)",
      shortLabel: "Speaking Part 1 (Q&A)",
      description: "Thu âm trả lời câu hỏi, AI chấm 4 tiêu chí.",
    },
    {
      code: "SPEAKING_PART_2",
      label: "Phần 2: Cue Card (Part 2)",
      shortLabel: "Speaking Part 2 (Cue Card)",
      description: "1 phút chuẩn bị, nói 1-2 phút theo các ý Cue Card.",
    },
    {
      code: "SPEAKING_PART_3",
      label: "Phần 3: Thảo luận (Part 3)",
      shortLabel: "Speaking Part 3 (Discussion)",
      description: "Câu hỏi phản biện (PEEL), AI chấm lập luận C1/C2.",
    },
    {
      code: "SPEAKING_SHADOWING",
      label: "Phần 4: Shadowing",
      shortLabel: "Shadowing phát âm",
      description: "Nghe câu mẫu và đọc nhại theo ngữ điệu.",
    },
  ],
  WRITING: [
    {
      code: "WRITING_PARAGRAPH",
      label: "Phần 1: Viết đoạn văn (B1-B2)",
      shortLabel: "Viết đoạn văn",
      description: "Viết đoạn 100-180 từ (Opinion, Adv-Disadv, Cause-Effect, Problem-Solution).",
    },
    {
      code: "WRITING_SHORT_EMAIL",
      label: "Phần 2: Đoạn ngắn & Email (A1-A2)",
      shortLabel: "Đoạn ngắn & Email",
      description: "Viết đoạn miêu tả / kể chuyện hoặc Email ngắn 40-80 từ.",
    },
    {
      code: "WRITING_IELTS_TASK1",
      label: "Phần 3: IELTS Task 1 (150 từ)",
      shortLabel: "IELTS Task 1",
      description: "Phân tích biểu đồ số liệu, quy trình (Process) hoặc bản đồ (Map).",
    },
    {
      code: "WRITING_IELTS_TASK2",
      label: "Phần 4: IELTS Task 2 & Luận C1 (250 từ)",
      shortLabel: "IELTS Task 2",
      description: "Viết luận học thuật 5 bước (Opinion, Discussion, Problem-Solution, Discursive C1).",
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
    if (subCode === "WRITING_DESCRIPTIVE_PARAGRAPH") {
      return [
        `Miêu tả (${level}): My favorite daily routine or weekend activity (40–80 words)`,
        `Miêu tả (${level}): Describe a close friend or family member (40–80 words)`,
        `Kể chuyện (${level}): A memorable trip or happy day in your childhood (40–80 words)`,
        `Miêu tả (${level}): Your ideal house or favorite room at home (40–80 words)`,
      ];
    }
    if (subCode === "WRITING_SHORT_EMAIL") {
      return [
        `Email (${level}): Invite a classmate to a weekend English study club (40–80 words)`,
        `Email (${level}): Thank a friend for helping you prepare for an exam (40–80 words)`,
        `Email (${level}): Apologize for missing a meeting and suggest a new time (40–80 words)`,
        `Email (${level}): Recommend a good restaurant or movie to your pen pal (40–80 words)`,
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
    if (subCode === "WRITING_DISCURSIVE_ESSAY") {
      return [
        "Discursive (C1): Artificial intelligence and academic integrity in universities (250+ words)",
        "Discursive (C1): Economic growth versus environmental sustainability in developing nations (250+ words)",
        "Discursive (C1): Should genetic engineering in healthcare be strictly regulated? (250+ words)",
        "Discursive (C1): Balancing digital privacy with national security in the information age (250+ words)",
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
  if (type === "SPEAKING" && subCode === "SPEAKING_PART_2") {
    return [
      `IELTS Part 2 Cue Card (${level}): Describe a memorable trip or place you visited`,
      `IELTS Part 2 Cue Card (${level}): Describe a useful skill you learned recently`,
      `IELTS Part 2 Cue Card (${level}): Describe a person who inspired you in your studies`,
      `IELTS Part 2 Cue Card (${level}): Describe a piece of technology you rely on daily`,
      `IELTS Part 2 Cue Card (${level}): Describe an achievement you are proud of`,
    ];
  }
  if (type === "SPEAKING" && subCode === "SPEAKING_PART_3") {
    return [
      `IELTS Part 3 Discussion (${level}): Technology, social media and human relationships`,
      `IELTS Part 3 Discussion (${level}): Urbanization, green spaces and sustainable cities`,
      `IELTS Part 3 Discussion (${level}): Work-life balance and changing career expectations`,
      `IELTS Part 3 Discussion (${level}): Traditional education vs lifelong self-learning`,
      `IELTS Part 3 Discussion (${level}): Globalization and preserving local cultural identity`,
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
          code: "WRITING_DESCRIPTIVE_PARAGRAPH",
          label: "1. Đoạn văn miêu tả / kể chuyện (40–80 từ)",
          description: "Viết đoạn ngắn miêu tả người, sở thích, thói quen hoặc kỷ niệm",
        },
        {
          code: "WRITING_SHORT_EMAIL",
          label: "2. Viết Email / Tin nhắn ngắn (40–80 từ)",
          description: "Email giao tiếp thực tế: mời bạn, cảm ơn, hỏi thăm hoặc xin lỗi",
        },
        {
          code: "WRITING_PARAGRAPH",
          label: "3. Đoạn văn theo gợi ý (Guided Paragraph)",
          description: "Viết 01 đoạn ngắn 40–80 từ dựa theo câu hỏi gợi ý",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "WRITING_OPINION",
          label: "1. Opinion Paragraph",
          description: "Đoạn 100–150 từ nêu quan điểm kèm ví dụ",
        },
        {
          code: "WRITING_ADV_DISADV",
          label: "2. Advantages & Disadvantages",
          description: "Phân tích ưu và nhược điểm của một xu hướng",
        },
        {
          code: "WRITING_CAUSE_EFFECT",
          label: "3. Cause & Effect",
          description: "Giải thích nguyên nhân và hệ quả",
        },
        {
          code: "WRITING_PROBLEM_SOLUTION",
          label: "4. Problem & Solution",
          description: "Nêu vấn đề và đề xuất giải pháp",
        },
        {
          code: "WRITING_PARAGRAPH",
          label: "5. Guided Academic Paragraph",
          description: "Đoạn học thuật 120–180 từ",
        },
      ];
    }
    return [
      {
        code: "WRITING_IELTS_TASK1",
        label: "IELTS Task 1: Biểu đồ, Quy trình & Bản đồ (150 từ)",
        description: "Báo cáo Line, Bar, Pie, Table, Process Diagram, Map",
      },
      {
        code: "WRITING_IELTS_TASK2",
        label: "IELTS Task 2: Nghị luận học thuật (250 từ)",
        description: "Chấm theo 4 tiêu chí TR, CC, LR, GRA",
      },
      {
        code: "WRITING_DISCURSIVE_ESSAY",
        label: "Discursive Academic Essay (C1 - 250+ từ)",
        description: "Luận phản biện đa chiều về xã hội, khoa học",
      },
    ];
  }

  if (skill === "READING") {
    if (isBeginner) {
      return [
        {
          code: "READING_FILL_BLANK",
          label: "1. Điền từ (Fact Completion)",
          description: "Lấy thông tin từ bài đọc điền chỗ trống",
        },
        {
          code: "READING_SHORT_ANSWER",
          label: "2. Trả lời ngắn (Short Answer)",
          description: "Trả lời ngắn dữ kiện trong bài đọc",
        },
        {
          code: "READING_MULTIPLE_CHOICE",
          label: "3. Trắc nghiệm (Multiple Choice)",
          description: "Chọn 1 trong 4 đáp án đúng",
        },
        {
          code: "READING_TRUE_FALSE",
          label: "4. Đúng / Sai (True / False)",
          description: "Xác thực thông tin theo bài đọc",
        },
        {
          code: "READING_MATCHING",
          label: "5. Ghép thông tin (Matching)",
          description: "Nối nhân vật, thời gian, sự kiện",
        },
        {
          code: "READING_PARAPHRASE",
          label: "6. Đoán nghĩa (Vocab in Context)",
          description: "Đoán nghĩa từ vựng/đại từ theo ngữ cảnh",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "READING_PARAPHRASE",
          label: "1. Paraphrasing & Synonyms",
          description: "Nhận diện cách diễn đạt tương đương",
        },
        {
          code: "READING_TRUE_FALSE",
          label: "2. True / False / Not Given",
          description: "Đánh giá thông tin đúng, sai hoặc không đề cập",
        },
        {
          code: "READING_MATCHING",
          label: "3. Matching Headings",
          description: "Chọn tiêu đề phù hợp cho từng đoạn",
        },
        {
          code: "READING_FILL_BLANK",
          label: "4. Summary Completion",
          description: "Điền từ vào đoạn tóm tắt bài đọc",
        },
        {
          code: "READING_MULTIPLE_CHOICE",
          label: "5. Trắc nghiệm suy luận (Inference)",
          description: "Suy luận ý ngầm và thái độ tác giả",
        },
      ];
    }
    return [
      {
        code: "READING_TRUE_FALSE",
        label: "1. True / False / Not Given (Học thuật)",
        description: "Đánh giá dữ kiện chuẩn đề IELTS",
      },
      {
        code: "READING_YES_NO",
        label: "2. Yes / No / Not Given (Quan điểm)",
        description: "Xác định quan điểm và luận điểm tác giả",
      },
      {
        code: "READING_MATCHING",
        label: "3. Matching Headings & Features",
        description: "Nối tiêu đề đoạn và đặc điểm nghiên cứu",
      },
      {
        code: "READING_FILL_BLANK",
        label: "4. Flow-chart & Summary Completion",
        description: "Hoàn thành quy trình hoặc tóm tắt sơ đồ",
      },
      {
        code: "READING_MULTIPLE_CHOICE",
        label: "5. Academic Multiple Choice",
        description: "Trắc nghiệm 4 lựa chọn mức độ nâng cao",
      },
    ];
  }

  if (skill === "GRAMMAR") {
    if (isBeginner) {
      return [
        {
          code: "GRAMMAR_MULTIPLE_CHOICE",
          label: "1. Trắc nghiệm thì (Multiple Choice)",
          description: "Hiện tại/quá khứ đơn, giới từ, mạo từ",
        },
        {
          code: "GRAMMAR_VERB_CONJUGATION",
          label: "2. Chia động từ (Verb Conjugation)",
          description: "Chia động từ trong ngoặc theo ngữ cảnh",
        },
        {
          code: "GRAMMAR_WORD_ARRANGEMENT",
          label: "3. Sắp xếp từ (Word Unscramble)",
          description: "Xếp từ thành câu đúng cấu trúc",
        },
        {
          code: "GRAMMAR_FILL_IN_BLANK",
          label: "4. Điền giới từ & đại từ",
          description: "Điền in/on/at, đại từ, sở hữu",
        },
        {
          code: "GRAMMAR_ERROR_CORRECTION",
          label: "5. Sửa lỗi sai cơ bản",
          description: "Tìm và sửa 1 lỗi ngữ pháp trong câu",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "GRAMMAR_ERROR_CORRECTION",
          label: "1. Sửa lỗi câu phức (Error ID)",
          description: "Hòa hợp chủ-vị, thì hoàn thành, mệnh đề quan hệ",
        },
        {
          code: "GRAMMAR_VERB_CONJUGATION",
          label: "2. Chia động từ (Passive & Conditionals)",
          description: "Thể bị động, câu điều kiện loại 1-2-3",
        },
        {
          code: "GRAMMAR_TRANSFORMATION",
          label: "3. Viết lại câu (Transformation)",
          description: "Chủ động - bị động, trực tiếp - gián tiếp",
        },
        {
          code: "GRAMMAR_MULTIPLE_CHOICE",
          label: "4. Trắc nghiệm câu phức & liên từ",
          description: "Mệnh đề quan hệ, liên từ nhượng bộ, điều kiện",
        },
        {
          code: "GRAMMAR_WORD_ARRANGEMENT",
          label: "5. Sắp xếp mệnh đề phức",
          description: "Ghép mệnh đề và trạng từ thành câu hoàn chỉnh",
        },
      ];
    }
    return [
      {
        code: "GRAMMAR_TRANSFORMATION",
        label: "1. Biến đổi cấu trúc (Cleft, Passive)",
        description: "Câu chẻ, bị động khách quan, mệnh đề phân từ",
      },
      {
        code: "GRAMMAR_ERROR_CORRECTION",
        label: "2. Sửa lỗi học thuật & Collocations",
        description: "Phát hiện lỗi ngữ pháp và tính mạch lạc",
      },
      {
        code: "GRAMMAR_INVERSION",
        label: "3. Đảo ngữ (Negative Inversion)",
        description: "Not only, Seldom, Hardly, Under no circumstances",
      },
      {
        code: "GRAMMAR_NOMINALISATION",
        label: "4. Danh từ hóa (Nominalisation)",
        description: "Chuyển động từ/tính từ sang cụm danh từ học thuật",
      },
      {
        code: "GRAMMAR_MULTIPLE_CHOICE",
        label: "5. Trắc nghiệm Band 8.0+",
        description: "Mixed conditionals, giả định thức (Subjunctive)",
      },
    ];
  }

  if (skill === "VOCABULARY") {
    if (isBeginner) {
      return [
        {
          code: "VOCAB_LISTEN_CHOOSE",
          label: "1. Nghe & Chọn từ (Listen & Choose)",
          description: "Nghe phát âm và chọn 1 trong 4 từ",
        },
        {
          code: "VOCAB_DICTATION",
          label: "2. Nghe chính tả (Listen & Type)",
          description: "Nghe phát âm và gõ đúng từ",
        },
        {
          code: "VOCAB_MEANING_TO_WORD",
          label: "3. Định nghĩa -> Từ (Meaning to Word)",
          description: "Đọc nghĩa và nhập từ tiếng Anh",
        },
        {
          code: "VOCAB_MATCHING",
          label: "4. Nối từ với nghĩa (Matching)",
          description: "Ghép cặp từ vựng với nghĩa",
        },
        {
          code: "VOCAB_WORD_FORM",
          label: "5. Dạng từ cơ bản (Word Form)",
          description: "Điền dạng danh từ / tính từ vào chỗ trống",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "VOCAB_WORD_FORM",
          label: "1. Word Form trong câu",
          description: "Biến đổi N / V / Adj / Adv theo ngữ cảnh",
        },
        {
          code: "VOCAB_COLLOCATION",
          label: "2. Collocations (make/do/take...)",
          description: "Các cụm từ tự nhiên hay đi cùng nhau",
        },
        {
          code: "VOCAB_SYNONYM_ANTONYM",
          label: "3. Đồng nghĩa / Trái nghĩa",
          description: "Chọn từ gần nghĩa (Closest) hoặc trái nghĩa (Opposite)",
        },
        {
          code: "VOCAB_WORD_FAMILY",
          label: "4. Họ từ (Word Family)",
          description: "Biến đổi gốc từ, tiền tố (un-, dis-) và hậu tố",
        },
        {
          code: "VOCAB_MEANING_TO_WORD",
          label: "5. Định nghĩa học thuật -> Từ",
          description: "Đọc định nghĩa học thuật và suy luận từ",
        },
        {
          code: "VOCAB_DICTATION",
          label: "6. Nghe chính tả từ học thuật",
          description: "Nghe phát âm kèm IPA và gõ đúng từ",
        },
      ];
    }
    return [
      {
        code: "VOCAB_COLLOCATION",
        label: "1. Collocations Band 7.5+",
        description: "Cụm từ học thuật dùng trong bài luận",
      },
      {
        code: "VOCAB_SYNONYM_ANTONYM",
        label: "2. Nuance Synonyms & Paraphrasing",
        description: "Phân biệt sắc thái từ đồng nghĩa học thuật",
      },
      {
        code: "VOCAB_WORD_FAMILY",
        label: "3. Họ từ nâng cao (Root & Affixes)",
        description: "Biến đổi gốc từ Hy Lạp / Latinh học thuật",
      },
      {
        code: "VOCAB_WORD_FORM",
        label: "4. Word Form học thuật",
        description: "Điền dạng từ chuẩn trong văn bản nghiên cứu",
      },
      {
        code: "VOCAB_MEANING_TO_WORD",
        label: "5. Định nghĩa chuyên sâu -> Từ",
        description: "Nhận diện thuật ngữ khoa học qua định nghĩa",
      },
    ];
  }

  if (skill === "LISTENING") {
    if (isBeginner) {
      return [
        {
          code: "LISTENING_FILL",
          label: "1. Nghe điền từ (Gap-fill Dictation)",
          description: "Nghe thông báo/đối thoại và điền từ vào chỗ trống",
        },
        {
          code: "LISTENING_DIALOGUE",
          label: "2. Nghe hội thoại (Dialogue Q&A)",
          description: "Nghe đối thoại 2 người trong tình huống hàng ngày",
        },
        {
          code: "LISTENING_MULTIPLE_CHOICE",
          label: "3. Trắc nghiệm nghe hiểu",
          description: "Chọn phương án đúng theo chi tiết bài nghe",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "LISTENING_DIALOGUE",
          label: "1. Hội thoại đa lượt (Multi-turn)",
          description: "Thảo luận công việc, phỏng vấn, kế hoạch",
        },
        {
          code: "LISTENING_FILL",
          label: "2. Nghe tóm tắt (Summary Gap-fill)",
          description: "Nghe và hoàn thành bản tóm tắt nội dung",
        },
        {
          code: "LISTENING_MULTIPLE_CHOICE",
          label: "3. Trắc nghiệm ý chính & bẫy",
          description: "Trắc nghiệm 4 đáp án với bẫy distractors",
        },
      ];
    }
    return [
      {
        code: "LISTENING_FILL",
        label: "1. IELTS Section 1 & 4 (Note Completion)",
        description: "Điền mẫu đơn và ghi chú bài giảng (No more than 2 words)",
      },
      {
        code: "LISTENING_MULTIPLE_CHOICE",
        label: "2. IELTS Section 2 & 3 (MC & Matching)",
        description: "Phân tích quan điểm nhiều người nói và ghép thông tin",
      },
      {
        code: "LISTENING_DIALOGUE",
        label: "3. Academic Tutorial Discussion",
        description: "Thảo luận học thuật về phương pháp nghiên cứu",
      },
    ];
  }

  if (skill === "SPEAKING") {
    if (isBeginner) {
      return [
        {
          code: "SPEAKING_SHADOWING",
          label: "1. Nhại câu (Shadowing Repetition)",
          description: "Nghe câu mẫu và đọc nhại theo ngữ điệu",
        },
        {
          code: "SPEAKING_QA",
          label: "2. Hỏi - Đáp cơ bản (Basic Q&A)",
          description: "Thu âm trả lời câu hỏi quen thuộc hàng ngày",
        },
        {
          code: "SPEAKING_PART_2",
          label: "3. Độc thoại ngắn (Simple Cue Card)",
          description: "Nói 1 phút theo thẻ gợi ý (Describe / You should say)",
        },
      ];
    }
    if (isIntermediate) {
      return [
        {
          code: "SPEAKING_QA",
          label: "1. Phỏng vấn (IELTS Part 1 / Q&A)",
          description: "Trả lời câu hỏi tự nhiên và mở rộng lý do",
        },
        {
          code: "SPEAKING_PART_2",
          label: "2. Cue Card (IELTS Part 2)",
          description: "Chuẩn bị 1 phút, nói 1-2 phút đủ ý You should say",
        },
        {
          code: "SPEAKING_PART_3",
          label: "3. Thảo luận (IELTS Part 3)",
          description: "Phân tích, so sánh và nêu dẫn chứng (PEEL)",
        },
        {
          code: "SPEAKING_SHADOWING",
          label: "4. Shadowing nối âm & ngữ điệu",
          description: "Luyện linking sounds, trọng âm và nhịp điệu",
        },
      ];
    }
    return [
      {
        code: "SPEAKING_PART_2",
        label: "1. IELTS Part 2 (Cue Card)",
        description: "Nói 2 phút theo Cue Card, AI chấm bám sát từng ý",
      },
      {
        code: "SPEAKING_PART_3",
        label: "2. IELTS Part 3 (Phản biện)",
        description: "Thảo luận vấn đề trừu tượng theo PEEL & từ vựng C1/C2",
      },
      {
        code: "SPEAKING_QA",
        label: "3. IELTS Part 1 / Interview",
        description: "Phỏng vấn phản xạ tự nhiên tiêu chí nâng cao",
      },
      {
        code: "SPEAKING_SHADOWING",
        label: "4. Shadowing học thuật & lưu loát",
        description: "Luyện phát âm diễn cảm và ngắt nghỉ theo cụm ý",
      },
    ];
  }

  return [];
};

export const QUESTION_TYPE_LABELS: Record<QuestionDraft["questionType"], string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "True / False / NG",
  FILL_IN_BLANK: "Điền từ",
  MATCHING: "Ghép cặp",
  AUDIO_RESPONSE: "Nói (Audio)",
  ESSAY: "Tự luận / Viết",
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  LISTENING: "Nghe",
  SPEAKING: "Nói",
  READING: "Đọc",
  WRITING: "Viết",
  VOCABULARY: "Từ vựng",
  GRAMMAR: "Ngữ pháp",
};

export const SKILL_BADGE_CLASS: Record<SkillKey, string> = {
  LISTENING: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SPEAKING: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  READING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  WRITING: "bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-500/30",
  VOCABULARY: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  GRAMMAR: "bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-600/30",
};
