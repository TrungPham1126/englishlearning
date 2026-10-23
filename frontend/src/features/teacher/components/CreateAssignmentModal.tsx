import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  FileText,
  Edit3,
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  CheckSquare,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  ChevronRight,
  Zap,
  Globe,
  Sliders,
  Users,
  Award,
  MessageSquare,
  ListChecks,
  Volume2,
  FileSpreadsheet,
  UploadCloud,
  FileAudio,
  Download,
  Type,
  Play,
  Square,
} from "lucide-react";
import * as XLSX from "xlsx";
import { teacherApi } from "../api/teacherApi";

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onSuccess: () => void;
  initialDate?: string;
}

export interface QuestionDraft {
  id: string;
  prompt: string;
  questionType: "MULTIPLE_CHOICE" | "FILL_IN_BLANK" | "AUDIO_RESPONSE" | "ESSAY" | "TRUE_FALSE";
  options: string[];
  correctAnswer: string;
  explanation?: string;
  referenceAudioUrl?: string;
  ipa?: string;
  targetWord?: string;
  transcript?: string;
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

// ================= BẢN ĐỒ CHỦ ĐỀ CHUẨN CEFR / IELTS THEO TỪNG KỸ NĂNG VÀ TRÌNH ĐỘ =================
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
    IELTS: [
      "Section 1: Rental Accommodation Inquiry and Tenancy Agreement",
      "Section 2: Guided Tour of a Botanic Garden and Visitor Guidelines",
      "Section 3: Student-Tutor Consultation on Research Methodology and Data",
      "Section 4: University Lecture on Deep Sea Hydrothermal Vents",
      "Section 1: Sports Club Membership and Facility Booking",
      "Section 4: Environmental Studies - Megafauna Extinction Theories",
    ],
  },
  VOCABULARY: {
    A1: [
      "Family Members, Home Objects and Daily Routines",
      "Common Food, Vegetables, Fruits and Beverages",
      "Basic Emotions, Feelings, Colors and Clothing Items",
      "School Supplies, Classroom Objects and School Subjects",
      "Animals, Pets, and Common Nature Words",
      "Days of the Week, Months, Seasons and Telling Time",
    ],
    A2: [
      "Travel, Transportation, Airports and Hotel Accommodations",
      "Jobs, Professions, Workplaces and Daily Responsibilities",
      "Weather Conditions, Natural Landscapes and Climate Seasons",
      "Health, Common Illnesses, Medicine and Doctor Visits",
      "Shopping, Department Stores, Prices and Payments",
      "Hobbies, Sports, Leisure Activities and Musical Instruments",
    ],
    B1: [
      "Workplace Communication, Office Etiquette and Management",
      "Environment, Ecology, Recycling and Green Lifestyle",
      "Digital Technology, Smart Devices and Social Networks",
      "Physical Fitness, Nutrition and Mental Wellbeing",
      "Entertainment, Mass Media, Film Genres and Journalism",
      "Money, Personal Finance, Banking and Budgeting Skills",
    ],
    B2: [
      "Academic Discourse, Abstract Ideas and Logical Connectors",
      "Scientific Innovation, Artificial Intelligence and Biotechnology",
      "Global Economy, International Trade and Financial Markets",
      "Human Psychology, Cognitive Behavior and Personality Traits",
      "Law, Governance, Civil Rights and Public Policy",
      "High-Frequency Collocations with Make, Do, Take, Have, and Bring",
    ],
    C1: [
      "Academic Research Nomenclature and Methodological Terms",
      "Sophisticated Idiomatic Expressions and Subtle Collocations",
      "Epistemology, Cognitive Science and Philosophical Debates",
      "Geopolitics, Macroeconomic Dynamics and Fiscal Policy",
      "Environmental Jurisprudence, Climate Ethics and Sustainability",
      "Nuanced Synonyms for Analytical and Critical Evaluation",
    ],
    IELTS: [
      "Band 7.5+ Academic Collocations, Phrasal Verbs and Synonyms",
      "Topic Vocabulary: Climate Change, Biodiversity and Renewable Power",
      "Topic Vocabulary: Technology, Automation and Digital Surveillance",
      "Topic Vocabulary: Education Systems, Pedagogy and Lifelong Learning",
      "Topic Vocabulary: Urbanization, Infrastructure and Megacities",
      "Topic Vocabulary: Globalization, Heritage Preservation and Tourism",
    ],
  },
  GRAMMAR: {
    A1: [
      "Present Simple Tense & Daily Habits",
      "Subject Pronouns, Possessive Adjectives and 'To Be'",
      "Basic Prepositions of Place and Time (in, on, at)",
      "There is / There are with Countable and Uncountable Nouns",
      "Wh- Questions (What, Where, When, Who, Why, How)",
      "Can / Can't for Ability and Asking Permission",
    ],
    A2: [
      "Past Simple Tense: Regular vs Irregular Verbs",
      "Comparative and Superlative Adjectives",
      "Modals of Obligation and Advice (Must, Have to, Should)",
      "Future Plans with 'Be Going to' vs 'Will'",
      "Quantifiers: Much, Many, A lot of, Few, Little",
      "Past Continuous and Past Simple with 'When' and 'While'",
    ],
    B1: [
      "Present Perfect vs Past Simple in Communicative Contexts",
      "First and Second Conditionals (Real vs Hypothetical Situations)",
      "Passive Voice across Present, Past and Future Tenses",
      "Defining and Non-defining Relative Clauses (Who, Which, That)",
      "Verb Patterns: Gerunds vs Infinitives (Stop to do vs Stop doing)",
      "Reported Speech for Statements and Polite Requests",
    ],
    B2: [
      "Third Conditional and Mixed Conditionals in Speculation",
      "Reported Speech with Advanced Reporting Verbs (Admit, Deny, Urge)",
      "Inversion with Negative Adverbials (Seldom, Rarely, Not only)",
      "Participle Clauses (-ing, -ed) for Concise Academic Writing",
      "Modals of Past Deduction (Must have, Can't have, Might have)",
      "Subjunctive Mood and Wish / If Only for Past Regrets",
    ],
    C1: [
      "Negative Inversion and Fronting for Rhetorical Emphasis",
      "Cleft Sentences (It was... that / What I need is...) for Focus",
      "Formal Inverted Conditionals (Had we known, Were they to arrive)",
      "Nominalisation and Dense Syntactic Structures for Papers",
      "Advanced Cohesive Devices, Ellipsis and Substitution",
      "Complex Passive Voice and Impersonal Reporting (It is claimed that)",
    ],
    IELTS: [
      "Complex Sentence Structures and Compound-Complex Clauses (Band 8+)",
      "Conditionals (Type 2, Type 3, Mixed) for IELTS Writing & Speaking",
      "Impersonal Passive Voice and Hedging for Academic Reports",
      "Nominalisation and Prepositional Phrases for Concise Essays",
      "Fronting and Inversion for Emphatic Arguments in Task 2",
      "Parallel Structures and Advanced Linking Transitions",
    ],
  },
  SPEAKING: {
    A1: [
      "Part 1: Self-introduction, Age, Hometown and Daily Routine",
      "Part 1: My Favorite Food, Favorite Drinks and Daily Meals",
      "Part 1: Hobbies, Free Time Activities and Weekend Plans",
      "Part 1: Describing My Family Members and Closest Friends",
      "Part 1: My House, Bedroom and Neighborhood",
      "Part 1: Seasons, Weather Preferences and What I Wear",
    ],
    A2: [
      "Part 1: My School, University or Current Job Routine",
      "Part 2: Describe a Memorable Vacation or Countryside Trip",
      "Part 2: Describe Your Favorite Season and Outdoor Activities",
      "Part 2: Describe a Special Birthday Party or Family Celebration",
      "Part 1: Transportation, Commuting and Daily Travel Habits",
      "Part 2: Describe Your Dream Job and Career Ambitions",
    ],
    B1: [
      "Part 2: Describe a Book or Film That Made a Strong Impression on You",
      "Part 2: Describe an Inspiring Teacher or Mentor in Your Life",
      "Part 2: Describe an Unforgettable Journey or Adventure You Took",
      "Part 3: Advantages and Disadvantages of Studying Abroad",
      "Part 3: How Modern Social Media Has Transformed Friendships",
      "Part 2: Describe a Challenging Decision You Had to Make",
    ],
    B2: [
      "Part 2: Describe an Important Environmental Issue in Your Country",
      "Part 2: Describe a Technological Device That Changed Your Life",
      "Part 3: Ethical Concerns Around Artificial Intelligence and Privacy",
      "Part 3: The Social Impact of Fast Fashion and Consumer Culture",
      "Part 3: Achieving Work-Life Balance in Fast-Paced Modern Societies",
      "Part 2: Describe a Time You Successfully Solved a Difficult Problem",
    ],
    C1: [
      "Part 3: Epistemic Responsibility and Combating Misinformation Online",
      "Part 3: Ethical Boundaries of Genetic Engineering and Bio-enhancement",
      "Part 3: Cultural Homogenization vs Preservation of Indigenous Heritage",
      "Part 3: Universal Basic Income and the Automation of Knowledge Work",
      "Part 3: The Geopolitics of Space Exploration vs Terrestrial Priorities",
      "Part 3: The Evolution of Higher Education in an AI-Dominated Era",
    ],
    IELTS: [
      "Part 1: Hometown, Daily Routines, Work/Study and Leisure Time",
      "Part 2: Describe an Ambitious Long-Term Goal You Successfully Achieved",
      "Part 2: Describe an Environmental Law or Rule You Would Like to Introduce",
      "Part 3: The Influence of Algorithmic Advertising on Consumer Behavior",
      "Part 3: Robotics, Artificial Intelligence and the Future Labor Market",
      "Part 2: Describe a Traditional Craft or Cultural Heritage of Your Country",
    ],
  },
  WRITING: {
    A1: [
      "Describe your typical Sunday morning routine (30-50 words)",
      "Introduce your family members and what they like doing (30-50 words)",
      "Write a short description of your bedroom and furniture (30-50 words)",
      "My favorite animal and why I love it (30-50 words)",
      "Write an invitation message to a friend for a birthday party (30-50 words)",
      "Describe what you usually eat for breakfast and lunch (30-50 words)",
    ],
    A2: [
      "Write about a memorable weekend trip to the countryside (50-80 words)",
      "Describe your favorite festival, holiday or celebration (50-80 words)",
      "Write an email describing your new school or work environment (50-80 words)",
      "Write a short review of a café or restaurant you visited (50-80 words)",
      "Five practical tips for living a healthier daily lifestyle (50-80 words)",
      "Write a postcard to a friend while traveling on vacation (50-80 words)",
    ],
    B1: [
      "Advantages and disadvantages of online education vs classroom learning (120-150 words)",
      "Opinion: Should school uniforms be mandatory for all students? (120-150 words)",
      "Write an email of complaint to a company about a damaged product (120-150 words)",
      "The benefits of regular physical exercise on mental well-being (120-150 words)",
      "How digital smartphones have changed human communication (120-150 words)",
      "Describe an eco-friendly habit everyone should adopt at home (120-150 words)",
    ],
    B2: [
      "Opinion Essay: Should public transportation be completely free in megacities? (180-250 words)",
      "Discussion Essay: Balancing economic growth with environmental conservation (180-250 words)",
      "Problem-Solution: Tackling rising youth unemployment in metropolitan areas (180-250 words)",
      "Argumentative Essay: Will AI replace human creativity in arts and writing? (180-250 words)",
      "Formal Proposal: Strategies to enhance workplace mental health and wellbeing (180-250 words)",
      "Causes and Effects: The consequences of social media on adolescent sleep (180-250 words)",
    ],
    C1: [
      "Critical Analysis: Algorithmic decision-making in public governance and ethics (250-350 words)",
      "Academic Evaluation: The scalability and limitations of carbon capture technologies (250-350 words)",
      "Discursive Essay: Meritocracy vs socioeconomic stratification in modern economies (250-350 words)",
      "Persuasive Essay: Intellectual property rights in the age of generative AI (250-350 words)",
      "Analytical Synthesis: Reconciling national security surveillance with personal privacy (250-350 words)",
      "Scholarly Review: The impact of neoliberal economic policies on public higher education (250-350 words)",
    ],
    IELTS: [
      "Task 1: Line Graph - Global Renewable Energy Share from 2000 to 2025",
      "Task 1: Bar Chart - Consumer Spending on Tech Gadgets across 5 European Countries",
      "Task 1: Pie Charts - Water Usage by Agricultural and Domestic Sectors in Australia",
      "Task 1: Table - International Tourist Arrivals and Tourism Revenue (2015-2023)",
      "Task 1: Process Diagram - Industrial Water Purification and Desalination Cycle",
      "Task 1: Map Comparison - City Center Infrastructure Redevelopment (2000 vs Present)",
      "Task 2 Opinion: Some argue higher education should be free for all citizens",
      "Task 2 Discussion: Should remote working permanently replace traditional offices?",
      "Task 2 Problem-Solution: Overpopulation, traffic congestion and urban sprawl in megacities",
      "Task 2 Advantages-Disadvantages: Society's growing reliance on artificial intelligence",
    ],
  },
};

/**
 * Trả về danh sách chủ đề trọng tâm gợi ý theo trình độ CEFR / IELTS, kỹ năng và dạng bài con.
 */
export const getSuggestedTopics = (
  type: string,
  level: string,
  subCode?: string,
  readingPassage?: number,
  writingTask?: string
): string[] => {
  // 1. Phân loại theo nhiệm vụ chi tiết của Writing (Sub-formats)
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

  // 2. Phân loại theo Speaking Shadowing vs QA
  if (type === "SPEAKING" && subCode === "SPEAKING_SHADOWING") {
    return [
      `Shadowing (${level}): Linking sounds and reduction in daily conversations`,
      `Shadowing (${level}): Connected speech and intonation in workplace dialogues`,
      `Shadowing (${level}): Sentence stress and expressing opinions naturally`,
      `Shadowing (${level}): Weak forms of auxiliary verbs and natural rhythm`,
      `Shadowing (${level}): Fluent storytelling, pacing and natural breath groups`,
    ];
  }

  // 3. Phân loại theo Vocabulary Sub-formats
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

  // 4. Phân loại theo Grammar Sub-formats
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

  // 5. Phân loại theo Listening Sub-formats
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

  // 6. Truy xuất mặc định từ LEVEL_TOPICS_MAP
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

// ================= ĐỊNH DẠNG CÂU HỎI THÍCH ỨNG CHUẨN THEO TỪNG TRÌNH ĐỘ & KỸ NĂNG =================
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
    // C1 & IELTS
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
    // C1 & IELTS
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
    // C1 & IELTS
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
    // C1 & IELTS
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
    // C1 & IELTS
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
    // C1 & IELTS
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

export default function CreateAssignmentModal({
  isOpen,
  onClose,
  classId,
  onSuccess,
  initialDate,
}: CreateAssignmentModalProps) {
  const [step, setStep] = useState<number>(1);
  const [creationSource, setCreationSource] = useState<
    "AI" | "TEXT_AI" | "EXCEL" | "MANUAL" | "RESOURCE"
  >("AI");

  // Neural Studio TTS state
  const [isSynthesizingTts, setIsSynthesizingTts] = useState<boolean>(false);
  const [ttsVoice, setTtsVoice] = useState<string>("af_heart");
  const [ttsSpeed, setTtsSpeed] = useState<string>("1.0x");
  const [synthesizeAudioError, setSynthesizeAudioError] = useState<string | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const [rawText, setRawText] = useState<string>("");
  const [mainAudioUrl, setMainAudioUrl] = useState<string>("");
  const [mainTranscript, setMainTranscript] = useState<string>("");
  const [readingPassageText, setReadingPassageText] = useState<string>("");
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [audioUploadSuccess, setAudioUploadSuccess] = useState<string | null>(null);
  const [isPlayingMainAudio, setIsPlayingMainAudio] = useState<boolean>(false);
  const [assignmentType, setAssignmentType] = useState<
    "VOCABULARY" | "READING" | "LISTENING" | "SPEAKING" | "WRITING" | "GRAMMAR"
  >("READING");
  const [speakingMode, setSpeakingMode] = useState<"QA" | "SHADOWING">("SHADOWING");
  const [writingTaskType, setWritingTaskType] = useState<"TASK_1" | "TASK_2">("TASK_2");
  const [readingPassageIelts, setReadingPassageIelts] = useState<1 | 2 | 3>(1);
  const [selectedSubFormat, setSelectedSubFormat] = useState<string>("READING_FILL_BLANK");

  // Data sources
  const [globalResources, setGlobalResources] = useState<any[]>([]);
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("NEW_DAY");

  // AI Generator state
  const [aiTopic, setAiTopic] = useState<string>("Anna's Daily Routine and Her Job at a Small Café");
  const [aiLevel, setAiLevel] = useState<string>("A1");
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Questions editor list (Editable by teacher)
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // Metadata & Schedule
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0],
  );
  const [startTime, setStartTime] = useState<string>("08:00");
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
  );
  const [targetStudents, setTargetStudents] = useState<"ALL" | "WEAK_STUDENTS">("ALL");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && classId) {
      loadInitialData();
    }
  }, [isOpen, classId]);

  useEffect(() => {
    const subs = SUB_PARTS_CONFIG[assignmentType] || [];
    const currentSub = subs.find((s) => s.code === selectedSubFormat) || subs[0];
    const subLabel = currentSub ? currentSub.shortLabel : assignmentType;
    setTitle(`${subLabel} (${aiLevel}) - Ngày ${scheduledDate}`);
  }, [assignmentType, selectedSubFormat, aiLevel, scheduledDate]);

  const loadInitialData = async () => {
    try {
      const [resResources, resPlans]: any = await Promise.allSettled([
        teacherApi.getGlobalResources(),
        teacherApi.getDailyPlans(classId),
      ]);
      if (resResources.status === "fulfilled" && resResources.value?.data) {
        setGlobalResources(resResources.value.data?.data || []);
      }
      if (resPlans.status === "fulfilled" && resPlans.value?.data) {
        const loadedPlans = resPlans.value.data?.data || [];
        setDailyPlans(loadedPlans);
        const match = loadedPlans.find((p: any) => p.scheduledDate === scheduledDate);
        if (match) {
          setSelectedPlanId(match.id);
        } else if (loadedPlans.length > 0) {
          setSelectedPlanId(loadedPlans[0].id);
          setScheduledDate(loadedPlans[0].scheduledDate);
        } else {
          setSelectedPlanId("NEW_DAY");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Danh sách định dạng câu hỏi tự động thích ứng chuẩn theo Trình Độ (CEFR/IELTS) & Kỹ Năng
  const currentLevelFormats = useMemo(() => {
    return getLevelQuestionFormats(assignmentType, aiLevel);
  }, [assignmentType, aiLevel]);

  // Danh sách chủ đề gợi ý tự động thay đổi theo Kỹ Năng + Trình Độ (CEFR/IELTS) + Dạng bài (Sub-task)
  const suggestedTopics = useMemo(() => {
    return getSuggestedTopics(
      assignmentType,
      aiLevel,
      selectedSubFormat,
      readingPassageIelts,
      writingTaskType
    );
  }, [assignmentType, aiLevel, selectedSubFormat, readingPassageIelts, writingTaskType]);

  const updateTopicSuggestion = (
    newType: string,
    newLevel: string,
    subCode?: string,
    wTaskOrPassage?: string | number,
    rPassage?: number
  ) => {
    let passage = typeof wTaskOrPassage === "number" ? wTaskOrPassage : rPassage;
    let writingTask = typeof wTaskOrPassage === "string" ? wTaskOrPassage : undefined;
    let code = subCode || selectedSubFormat;

    if (code === "TASK_1" || code === "TASK_2") {
      writingTask = code;
      code = code === "TASK_1" ? "WRITING_IELTS_TASK1" : "WRITING_IELTS_TASK2";
    }

    const topics = getSuggestedTopics(
      newType,
      newLevel,
      code,
      passage || readingPassageIelts,
      writingTask || writingTaskType
    );
    if (topics && topics.length > 0) {
      setAiTopic(topics[0]);
    }
  };

  // Chọn dạng bài tập (Đồng bộ 2 chiều giữa Mục 1.1 và AI Studio)
  const handleSelectSubFormat = (code: string, targetLevel?: string) => {
    const lvl = targetLevel || aiLevel;
    setSelectedSubFormat(code);
    if (assignmentType === "SPEAKING") {
      setSpeakingMode(code.includes("SHADOWING") ? "SHADOWING" : "QA");
    }
    if (assignmentType === "WRITING") {
      if (code === "WRITING_IELTS_TASK1") setWritingTaskType("TASK_1");
      if (code === "WRITING_IELTS_TASK2") setWritingTaskType("TASK_2");
    }
    updateTopicSuggestion(assignmentType, lvl, code);
  };

  // Chọn trình độ CEFR / IELTS (Đồng bộ 2 chiều giữa Mục 1.1 và AI Studio)
  const handleSelectLevel = (newLevel: string) => {
    setAiLevel(newLevel);
    const nextFormats = getLevelQuestionFormats(assignmentType, newLevel);
    if (nextFormats.length > 0 && !nextFormats.some((f) => f.code === selectedSubFormat)) {
      handleSelectSubFormat(nextFormats[0].code, newLevel);
    } else {
      updateTopicSuggestion(assignmentType, newLevel);
    }
  };

  if (!isOpen) return null;

  // Handle AI Question Generation (Hoàn toàn từ AI, KHÔNG MOCK)
  const handleGenerateAiQuestions = async (customTopicOrPrompt?: string) => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const promptToUse = (customTopicOrPrompt || aiTopic || "General Practice").trim();

      // Đảm bảo exType luôn đồng bộ tuyệt đối với assignmentType hiện tại, không dùng định dạng cũ
      let exType = selectedSubFormat;
      if (assignmentType === "SPEAKING") {
        exType =
          speakingMode === "SHADOWING" || (selectedSubFormat && selectedSubFormat.includes("SHADOWING"))
            ? "SPEAKING_SHADOWING"
            : "SPEAKING_QA";
      } else if (assignmentType === "GRAMMAR") {
        if (!exType || !exType.startsWith("GRAMMAR")) {
          exType = "GRAMMAR_MULTIPLE_CHOICE";
        }
      } else if (assignmentType === "READING") {
        if (!exType || !exType.startsWith("READING")) {
          exType = "READING_MULTIPLE_CHOICE";
        }
      } else if (assignmentType === "VOCABULARY") {
        if (!exType || !exType.startsWith("VOCAB")) {
          exType = "VOCAB_MEANING_TO_WORD";
        }
      } else if (assignmentType === "LISTENING") {
        if (!exType || !exType.startsWith("LISTENING")) {
          exType = "LISTENING_MC";
        }
      } else if (assignmentType === "WRITING") {
        if (!exType || !exType.startsWith("WRITING")) {
          exType = "WRITING_PARAGRAPH";
        }
      }

      const res: any = await teacherApi.generateAiQuiz({
        topic: promptToUse,
        level: aiLevel,
        questionCount: aiQuestionCount,
        exerciseType: exType,
        skillType: assignmentType,
        assignmentType: assignmentType,
      });

      const data = res.data?.data || res.data;
      let rawJsonStr = data?.rawResponseJson;
      let parsed: any = null;

      if (typeof rawJsonStr === "string") {
        try {
          parsed = JSON.parse(rawJsonStr);
        } catch (e) {
          console.error("Lỗi parse rawResponseJson:", e);
        }
      } else if (typeof rawJsonStr === "object" && rawJsonStr !== null) {
        parsed = rawJsonStr;
      } else if (data?.questions) {
        parsed = data;
      }

      const rawQuestions = parsed?.questions || [];
      if (!rawQuestions || rawQuestions.length === 0) {
        const errorMsg =
          data?.message ||
          "AI không thể tạo được danh sách câu hỏi phù hợp. Vui lòng kiểm tra lại chủ đề hoặc cấu hình.";
        setAiError(errorMsg);
        alert(`⚠️ ${errorMsg}`);
        return; // Dừng lại ở Bước 1 để giáo viên xem lỗi, TUYỆT ĐỐI KHÔNG MOCK DỮ LIỆU
      }

      const readingPassage = (parsed?.readingPassage || "").trim();
      if (readingPassage) {
        setReadingPassageText(readingPassage);
      }

      const listeningPassage = (
        parsed?.listeningPassage ||
        parsed?.audioScript ||
        rawQuestions[0]?.transcript ||
        ""
      ).trim();
      if (assignmentType === "LISTENING" && listeningPassage) {
        setMainTranscript(listeningPassage);
      }

      const preGeneratedListeningAudio = (
        parsed?.audioUrl ||
        parsed?.mediaUrl ||
        rawQuestions[0]?.audioUrl ||
        rawQuestions[0]?.mediaUrl ||
        ""
      ).trim();
      if (assignmentType === "LISTENING" && preGeneratedListeningAudio && !preGeneratedListeningAudio.includes("translate.google")) {
        setMainAudioUrl(preGeneratedListeningAudio);
      }

      const isShadowingTask =
        assignmentType === "SPEAKING" &&
        (speakingMode === "SHADOWING" ||
          selectedSubFormat.includes("SHADOWING") ||
          parsed?.speakingMode === "SHADOWING");
      if (isShadowingTask) {
        setSpeakingMode("SHADOWING");
        setSelectedSubFormat("SPEAKING_SHADOWING");
      }

      const formatted: QuestionDraft[] = rawQuestions.map((q: any, idx: number) => {
        let questionPrompt =
          q.prompt ||
          q.question ||
          q.promptText ||
          q.sentence ||
          q.text ||
          (q.definition ? `Đoán từ vựng qua định nghĩa: "${q.definition}"${q.word ? ` (${q.word.charAt(0)}...)` : ""}` : "") ||
          (q.word ? `Từ vựng cần học: "${q.word}"` : "") ||
          `Câu hỏi ${idx + 1}`;

        // LOẠI BỎ [READING PASSAGE] KHỎI TỪNG CÂU HỎI ĐỂ ĐOẠN VĂN CHỈ HIỂN THỊ TRÊN CÙNG
        if (questionPrompt.includes("[READING PASSAGE]")) {
          const parts = questionPrompt.split(/\[READING PASSAGE\]/i);
          const after = parts[1] || "";
          const dIdx = after.lastIndexOf("\n\n");
          if (dIdx !== -1) {
            const extracted = after.substring(0, dIdx).trim();
            if (extracted && !readingPassage) {
              setReadingPassageText(extracted);
            }
            questionPrompt = after.substring(dIdx + 2).trim();
          } else {
            questionPrompt = after.trim();
          }
        }

        let qType: QuestionDraft["questionType"] = "MULTIPLE_CHOICE";
        let opts: string[] = [];
        let correct = String(
          q.correctAnswer ||
          q.answer ||
          q.correct ||
          q.correct_answer ||
          q.targetWord ||
          q.word ||
          ""
        ).trim();

        const subFormat = String(selectedSubFormat || "").toUpperCase();
        const rawQType = String(q.questionType || q.type || "").toUpperCase();

        const isFillInBlank =
          subFormat.includes("FILL") ||
          subFormat.includes("BLANK") ||
          subFormat.includes("WORD_FORM") ||
          subFormat.includes("MEANING_TO_WORD") ||
          subFormat.includes("DEFINITION") ||
          subFormat.includes("DICTATION") ||
          subFormat.includes("SPELL") ||
          subFormat.includes("CONJUGAT") ||
          subFormat.includes("WORD_ARRANGEMENT") ||
          subFormat.includes("UNSCRAMBLE") ||
          subFormat.includes("ERROR_CORRECTION") ||
          subFormat.includes("TRANSFORMATION") ||
          rawQType.includes("FILL") ||
          rawQType.includes("BLANK") ||
          rawQType.includes("SHORT_ANSWER") ||
          rawQType.includes("WORD_ARRANGEMENT") ||
          rawQType.includes("SPELL") ||
          rawQType.includes("COMPLETION") ||
          rawQType.includes("WORD_FORM") ||
          rawQType.includes("FORM") ||
          rawQType.includes("CONJUGAT") ||
          rawQType.includes("DICTATION") ||
          rawQType.includes("TRANSFORM") ||
          rawQType.includes("CORRECTION") ||
          rawQType.includes("UNSCRAMBLE") ||
          rawQType.includes("GAP");

        const isTrueFalse =
          subFormat.includes("TRUE_FALSE") ||
          rawQType.includes("TRUE") ||
          rawQType.includes("FALSE");

        if (assignmentType === "SPEAKING") {
          qType = "AUDIO_RESPONSE";
          if (isShadowingTask) {
            const cleanRef = (correct || questionPrompt)
              .replace(/^(?:shadowing|repeat after me|listen and repeat|câu\s*\d+)[:\s\-–—]+/i, "")
              .trim();
            questionPrompt = cleanRef;
            correct = cleanRef;
          } else {
            correct = correct || "";
          }
        } else if (assignmentType === "WRITING") {
          const isSentenceWriting =
            subFormat.includes("WORD_ARRANGEMENT") ||
            subFormat.includes("UNSCRAMBLE") ||
            subFormat.includes("WORD_ORDER") ||
            subFormat.includes("SENTENCE") ||
            subFormat.includes("KEYWORD") ||
            rawQType.includes("FILL") ||
            rawQType.includes("BLANK") ||
            rawQType.includes("ARRANGE") ||
            rawQType.includes("UNSCRAMBLE") ||
            questionPrompt.includes("______") ||
            questionPrompt.includes(" / ") ||
            questionPrompt.toLowerCase().includes("sắp xếp") ||
            questionPrompt.toLowerCase().includes("hoàn thành câu") ||
            questionPrompt.toLowerCase().includes("từ gợi ý");

          if (isSentenceWriting) {
            qType = "FILL_IN_BLANK";
            correct = correct || q.correctAnswer || "";
          } else {
            qType = "ESSAY";
            correct = correct || q.correctAnswer || "";
          }
        } else if (isFillInBlank) {
          qType = "FILL_IN_BLANK";
        } else if (isTrueFalse) {
          qType = "TRUE_FALSE";
          correct = (correct || "TRUE").toUpperCase();
          opts = ["TRUE", "FALSE", "NOT GIVEN"];
        } else {
          qType = "MULTIPLE_CHOICE";

          const rawOptions = q.options || q.choices || q.answers || q.distractors;
          if (Array.isArray(rawOptions) && rawOptions.length > 0) {
            opts = rawOptions
              .map((opt: any) =>
                typeof opt === "string" ? opt : opt.text || opt.label || opt.value || ""
              )
              .filter((s: string) => typeof s === "string" && s.trim().length > 0);

            const correctOpt = rawOptions.find(
              (opt: any) => opt && (opt.isCorrect || opt.correct),
            );
            if (correctOpt) {
              correct = typeof correctOpt === "string" ? correctOpt : correctOpt.text || correctOpt.label || "";
            }
          } else if (typeof rawOptions === "object" && rawOptions !== null) {
            const keys = Object.keys(rawOptions);
            opts = keys
              .map((k) => {
                const val = rawOptions[k];
                return typeof val === "string" ? val : String(val);
              })
              .filter((s: string) => s.trim().length > 0);
            if (keys.includes(correct)) {
              correct = rawOptions[correct];
            }
          } else if (q.optionA || q.optionB || q.optionC || q.optionD) {
            opts = [q.optionA, q.optionB, q.optionC, q.optionD].filter(
              (s: any) => typeof s === "string" && s.trim().length > 0
            );
          }

          // If correct answer is a letter A/B/C/D mapping to opts
          if (opts.length > 0) {
            const letterIdx = ["A", "B", "C", "D"].indexOf(String(correct).toUpperCase().trim());
            if (letterIdx >= 0 && opts[letterIdx]) {
              correct = opts[letterIdx];
            } else if (!correct || !opts.includes(correct)) {
              correct = opts[0];
            }
          }

          // Nếu câu hỏi không có đủ 2 lựa chọn nhưng có đáp án đúng:
          // Tự động chuyển đổi mượt mà sang dạng điền đáp án (FILL_IN_BLANK), bảo toàn dữ liệu thật từ AI
          if (opts.length < 2) {
            if (correct && correct.trim()) {
              qType = "FILL_IN_BLANK";
              opts = [];
            } else {
              throw new Error(
                `Câu hỏi ${idx + 1} ("${questionPrompt}") thiếu đáp án hoặc danh sách lựa chọn từ AI. Không thể tạo câu hỏi.`
              );
            }
          }
        }

        let rawAudio = "";
        let targetWord = "";
        let ipa = "";
        let transcript = q.transcript || listeningPassage || "";

        if (assignmentType === "VOCABULARY") {
          targetWord = q.targetWord || q.word || correct || "";
          ipa = q.ipa || "";
          rawAudio = q.audioUrl || q.mediaUrl || "";
          const cleanWord = targetWord.replace(/\[.*?\]/g, "").replace(/[^a-zA-Z\s-]/g, "").trim();
          if (cleanWord && (!rawAudio || rawAudio.includes("api.dictionaryapi.dev"))) {
            rawAudio = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=2`;
          }
        } else if (assignmentType === "LISTENING") {
          // Quản lý tập trung ở cấp bài nghe (mainAudioUrl & mainTranscript), không nhân bản vào từng câu hỏi con
          rawAudio = "";
          transcript = "";
        } else if (assignmentType === "SPEAKING") {
          rawAudio = q.audioUrl || q.mediaUrl || "";
          if (rawAudio.includes("translate.google")) {
            rawAudio = "";
          }
        }

        return {
          id: `q-ai-${Date.now()}-${idx}`,
          prompt: questionPrompt,
          questionType: qType,
          options: opts,
          correctAnswer: correct,
          explanation: q.explanation || q.meaning || (q.part_of_speech ? `Từ loại: ${q.part_of_speech}` : "") || "",
          referenceAudioUrl: rawAudio,
          ipa: ipa,
          targetWord: targetWord,
          transcript: transcript,
        };
      });

      setQuestions(formatted);
      setAiError(null);
      setStep(2);
    } catch (err: any) {
      console.error("AI Generation error:", err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Lỗi không xác định khi gọi AI tạo bài tập. Vui lòng kiểm tra API Key hoặc kết nối mạng.";
      setAiError(errMsg);
      alert(`⚠️ Lỗi tạo bài tập AI:\n${errMsg}\n\nVui lòng kiểm tra lại cấu hình hoặc thử lại!`);
      // TUYỆT ĐỐI KHÔNG GỌI FALLBACK MOCK DATA, KHÔNG CHUYỂN BƯỚC 2
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Add new blank question manually
  const handleAddBlankQuestion = () => {
    const isSpeaking = assignmentType === "SPEAKING";
    const isWriting = assignmentType === "WRITING";
    const isSentenceWriting =
      isWriting &&
      (selectedSubFormat.includes("WORD_ARRANGEMENT") ||
        selectedSubFormat.includes("UNSCRAMBLE") ||
        selectedSubFormat.includes("WORD_ORDER") ||
        selectedSubFormat.includes("SENTENCE") ||
        selectedSubFormat.includes("KEYWORD"));

    const newQ: QuestionDraft = {
      id: `q-manual-${Date.now()}`,
      prompt: "",
      questionType: isSpeaking
        ? "AUDIO_RESPONSE"
        : isSentenceWriting
        ? "FILL_IN_BLANK"
        : isWriting
        ? "ESSAY"
        : "MULTIPLE_CHOICE",
      options: isSpeaking || isWriting ? [] : ["", "", "", ""],
      correctAnswer: "",
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestion = (id: string, field: keyof QuestionDraft, val: any) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const updated = { ...q, [field]: val };
        if (assignmentType === "SPEAKING" && speakingMode === "SHADOWING" && field === "prompt") {
          updated.correctAnswer = val;
        }
        return updated;
      }),
    );
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  // Tải File Mẫu Excel Chuẩn (.xlsx) cho tất cả các kỹ năng
  const handleDownloadExcelTemplate = () => {
    const sampleData = [
      {
        "STT": 1,
        "Kỹ năng (Skill)": "LISTENING",
        "Dạng câu hỏi (Type)": "MULTIPLE_CHOICE",
        "Đề bài / Câu hỏi (Prompt)": "What time does the conference begin tomorrow?",
        "Lựa chọn A": "8:30 AM",
        "Lựa chọn B": "9:00 AM",
        "Lựa chọn C": "9:30 AM",
        "Lựa chọn D": "10:00 AM",
        "Đáp án đúng (Correct Answer)": "9:00 AM",
        "Giải thích (Explanation)": "Người nói thông báo: 'Registration starts at 8:30, but the opening remarks begin at 9:00 AM.'",
        "Đoạn nghe / Kịch bản (Transcript)": "Welcome everyone to our annual innovation summit. Registration will commence at 8:30 AM in the main foyer. Please be seated by 8:50 AM because the keynote speech will begin promptly at 9:00 AM. Refreshments and networking will follow in room B.",
        "Từ vựng / IPA": "",
        "Điểm (Points)": 2
      },
      {
        "STT": 2,
        "Kỹ năng (Skill)": "LISTENING",
        "Dạng câu hỏi (Type)": "FILL_IN_BLANK",
        "Đề bài / Câu hỏi (Prompt)": "Refreshments will be served in room ______.",
        "Lựa chọn A": "",
        "Lựa chọn B": "",
        "Lựa chọn C": "",
        "Lựa chọn D": "",
        "Đáp án đúng (Correct Answer)": "B",
        "Giải thích (Explanation)": "Kịch bản bài nghe nêu rõ: 'Refreshments will follow in room B.'",
        "Đoạn nghe / Kịch bản (Transcript)": "Welcome everyone to our annual innovation summit. Registration will commence at 8:30 AM in the main foyer. Please be seated by 8:50 AM because the keynote speech will begin promptly at 9:00 AM. Refreshments and networking will follow in room B.",
        "Từ vựng / IPA": "",
        "Điểm (Points)": 2
      },
      {
        "STT": 3,
        "Kỹ năng (Skill)": "VOCABULARY",
        "Dạng câu hỏi (Type)": "MULTIPLE_CHOICE",
        "Đề bài / Câu hỏi (Prompt)": "Chọn từ đồng nghĩa với 'ENORMOUS':",
        "Lựa chọn A": "Tiny",
        "Lựa chọn B": "Gigantic",
        "Lựa chọn C": "Fragile",
        "Lựa chọn D": "Delicate",
        "Đáp án đúng (Correct Answer)": "Gigantic",
        "Giải thích (Explanation)": "'Enormous' và 'Gigantic' đều mang nghĩa là to lớn, khổng lồ.",
        "Đoạn nghe / Kịch bản (Transcript)": "",
        "Từ vựng / IPA": "enormous /ɪˈnɔːməs/",
        "Điểm (Points)": 2
      },
      {
        "STT": 4,
        "Kỹ năng (Skill)": "GRAMMAR",
        "Dạng câu hỏi (Type)": "MULTIPLE_CHOICE",
        "Đề bài / Câu hỏi (Prompt)": "If she ______ harder, she would pass the exam.",
        "Lựa chọn A": "studies",
        "Lựa chọn B": "studied",
        "Lựa chọn C": "had studied",
        "Lựa chọn D": "will study",
        "Đáp án đúng (Correct Answer)": "studied",
        "Giải thích (Explanation)": "Câu điều kiện loại 2 (vế If dùng thì quá khứ đơn, vế chính would + V).",
        "Đoạn nghe / Kịch bản (Transcript)": "",
        "Từ vựng / IPA": "",
        "Điểm (Points)": 2
      },
      {
        "STT": 5,
        "Kỹ năng (Skill)": "READING",
        "Dạng câu hỏi (Type)": "TRUE_FALSE",
        "Đề bài / Câu hỏi (Prompt)": "The company was founded in 1995.",
        "Lựa chọn A": "TRUE",
        "Lựa chọn B": "FALSE",
        "Lựa chọn C": "NOT GIVEN",
        "Lựa chọn D": "",
        "Đáp án đúng (Correct Answer)": "TRUE",
        "Giải thích (Explanation)": "Dòng 2 bài đọc ghi: 'Founded in 1995 by two university graduates...'",
        "Đoạn nghe / Kịch bản (Transcript)": "",
        "Từ vựng / IPA": "",
        "Điểm (Points)": 2
      },
      {
        "STT": 6,
        "Kỹ năng (Skill)": "WRITING",
        "Dạng câu hỏi (Type)": "ESSAY",
        "Đề bài / Câu hỏi (Prompt)": "Some people believe that technology reduces human interaction. Discuss both views and give your opinion.",
        "Lựa chọn A": "",
        "Lựa chọn B": "",
        "Lựa chọn C": "",
        "Lựa chọn D": "",
        "Đáp án đúng (Correct Answer)": "",
        "Giải thích (Explanation)": "Yêu cầu viết tối thiểu 250 từ, phân tích 2 mặt và nêu quan điểm cá nhân.",
        "Đoạn nghe / Kịch bản (Transcript)": "",
        "Từ vựng / IPA": "",
        "Điểm (Points)": 10
      },
      {
        "STT": 7,
        "Kỹ năng (Skill)": "SPEAKING",
        "Dạng câu hỏi (Type)": "AUDIO_RESPONSE",
        "Đề bài / Câu hỏi (Prompt)": "Describe your favorite hobby and explain why you enjoy it.",
        "Lựa chọn A": "",
        "Lựa chọn B": "",
        "Lựa chọn C": "",
        "Lựa chọn D": "",
        "Đáp án đúng (Correct Answer)": "",
        "Giải thích (Explanation)": "Nói trong vòng 1-2 phút, tập trung phát âm, từ vựng và độ trôi chảy.",
        "Đoạn nghe / Kịch bản (Transcript)": "",
        "Từ vựng / IPA": "",
        "Điểm (Points)": 10
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Cau_Hoi");
    XLSX.writeFile(wb, "Mau_Bai_Tap_Excel_Tieng_Anh.xlsx");
  };

  // Đọc và phân tích file Excel / CSV người dùng tải lên
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows || rows.length === 0) {
        alert("File Excel trống hoặc không có dòng dữ liệu hợp lệ!");
        return;
      }

      let detectedSkill = assignmentType;
      let detectedPassage = "";

      const parsedQuestions: QuestionDraft[] = rows.map((r, idx) => {
        const rawSkill = (r["Kỹ năng (Skill)"] || r["Skill"] || "").toString().toUpperCase().trim();
        if (rawSkill && ["VOCABULARY", "GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"].includes(rawSkill)) {
          detectedSkill = rawSkill as any;
        }

        const prompt = (
          r["Đề bài / Câu hỏi (Prompt)"] ||
          r["Prompt"] ||
          r["Câu hỏi"] ||
          r["Đề bài"] ||
          `Câu hỏi ${idx + 1}`
        ).toString().trim();

        const rawType = (
          r["Dạng câu hỏi (Type)"] ||
          r["Type"] ||
          r["Loại câu hỏi"] ||
          "MULTIPLE_CHOICE"
        ).toString().toUpperCase().trim();

        let questionType: QuestionDraft["questionType"] = "MULTIPLE_CHOICE";
        if (rawType.includes("FILL") || rawType.includes("GAP") || rawType.includes("ĐIỀN")) {
          questionType = "FILL_IN_BLANK";
        } else if (rawType.includes("AUDIO") || rawType.includes("SPEAK") || rawType.includes("NÓI")) {
          questionType = "AUDIO_RESPONSE";
        } else if (rawType.includes("ESSAY") || rawType.includes("WRITE") || rawType.includes("VIẾT")) {
          questionType = "ESSAY";
        } else if (rawType.includes("TRUE") || rawType.includes("ĐÚNG")) {
          questionType = "TRUE_FALSE";
        }

        const optA = (r["Lựa chọn A"] || r["A"] || r["Option A"] || "").toString().trim();
        const optB = (r["Lựa chọn B"] || r["B"] || r["Option B"] || "").toString().trim();
        const optC = (r["Lựa chọn C"] || r["C"] || r["Option C"] || "").toString().trim();
        const optD = (r["Lựa chọn D"] || r["D"] || r["Option D"] || "").toString().trim();

        let options: string[] = [];
        if (questionType === "TRUE_FALSE") {
          options = ["TRUE", "FALSE", "NOT GIVEN"];
        } else if (questionType === "MULTIPLE_CHOICE") {
          options = [optA, optB, optC, optD].filter(Boolean);
          if (options.length < 2) {
            options = ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"];
          }
        }

        const correctAnswer = (
          r["Đáp án đúng (Correct Answer)"] ||
          r["Đáp án"] ||
          r["Correct Answer"] ||
          optA ||
          ""
        ).toString().trim();

        const explanation = (r["Giải thích (Explanation)"] || r["Giải thích"] || "").toString().trim();
        const transcript = (
          r["Đoạn nghe / Kịch bản (Transcript)"] ||
          r["Transcript"] ||
          r["Kịch bản"] ||
          ""
        ).toString().trim();

        if (transcript && !detectedPassage) {
          detectedPassage = transcript;
        }

        const vocabIpa = (
          r["Từ vựng / IPA"] ||
          r["Từ mục tiêu / IPA (Target Word / IPA)"] ||
          r["Target Word"] ||
          r["Từ vựng"] ||
          ""
        ).toString().trim();

        let targetWord = "";
        let ipa = "";
        if (vocabIpa) {
          const parts = vocabIpa.split(/[\/\s]+/);
          targetWord = parts[0] || vocabIpa;
          if (vocabIpa.includes("/")) {
            const m = vocabIpa.match(/\/([^/]+)\//);
            if (m) ipa = "/" + m[1] + "/";
          }
        }

        return {
          id: `q-excel-${Date.now()}-${idx}`,
          prompt,
          questionType,
          options,
          correctAnswer,
          explanation,
          transcript: transcript || detectedPassage,
          targetWord: targetWord || undefined,
          ipa: ipa || undefined,
        };
      });

      setAssignmentType(detectedSkill);
      if (detectedPassage) {
        setMainTranscript(detectedPassage);
      }
      setQuestions(parsedQuestions);
      setStep(2);
    } catch (err: any) {
      alert("Lỗi đọc file Excel: " + (err.message || "File không đúng cấu trúc"));
    } finally {
      e.target.value = "";
    }
  };

  // Tổng hợp giọng đọc Neural Studio Voice
  const handleSynthesizeNeuralAudio = async () => {
    const textToSynthesize = (mainTranscript || questions.map((q) => q.prompt).join(". ")).trim();
    if (!textToSynthesize) {
      setSynthesizeAudioError("Vui lòng nhập kịch bản đoạn nghe (Listening Script) hoặc nội dung câu hỏi trước khi tạo audio!");
      return;
    }
    setSynthesizeAudioError(null);
    setAudioUploadSuccess(null);
    setIsSynthesizingTts(true);
    try {
      const res = await teacherApi.synthesizeAudio({
        text: textToSynthesize,
        voice: ttsVoice,
        speed: ttsSpeed,
      });
      const url = res.data?.data || (res as any).data;
      if (url) {
        setMainAudioUrl(url);
        setAudioUploadSuccess("Đã tạo âm thanh bài nghe hoàn tất");
        setSynthesizeAudioError(null);
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.message || (e.code === "ECONNABORTED" || e.message?.includes("timeout")
        ? "Quá thời gian xử lý khi tạo âm thanh bài nghe. Vui lòng bấm 'Thử tạo lại ngay'."
        : e.message || "Không thể tạo âm thanh lúc này.");
      setSynthesizeAudioError(errMsg);
    } finally {
      setIsSynthesizingTts(false);
    }
  };

  // Upload file audio chung của bài nghe từ máy tính
  const handleUploadMainAudio = async (file: File) => {
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioUploadSuccess(null);
    setSynthesizeAudioError(null);
    try {
      const res = await teacherApi.uploadAudioFile(file);
      const url = res.data?.data || (res as any).data;
      if (url) {
        setMainAudioUrl(url);
        setAudioUploadSuccess("Tải lên file audio thành công!");
      }
    } catch (e: any) {
      setSynthesizeAudioError("Tải lên file audio thất bại: " + (e.response?.data?.message || e.message));
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const resolvePlayableUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const togglePlayMainAudio = () => {
    if (!mainAudioUrl) return;
    if (isPlayingMainAudio) {
      const audioElem = document.getElementById("main-assignment-audio") as HTMLAudioElement;
      if (audioElem) {
        audioElem.pause();
        audioElem.currentTime = 0;
      }
      setIsPlayingMainAudio(false);
    } else {
      const resolved = resolvePlayableUrl(mainAudioUrl);
      let audioElem = document.getElementById("main-assignment-audio") as HTMLAudioElement;
      if (!audioElem) {
        audioElem = new Audio(resolved);
        audioElem.id = "main-assignment-audio";
        document.body.appendChild(audioElem);
      } else {
        audioElem.src = resolved;
      }
      audioElem.onended = () => setIsPlayingMainAudio(false);
      audioElem.onerror = () => {
        setIsPlayingMainAudio(false);
        setSynthesizeAudioError("Không thể phát file âm thanh này");
      };
      audioElem.play().then(() => setIsPlayingMainAudio(true)).catch(() => setIsPlayingMainAudio(false));
    }
  };

  const handlePreviewTranscriptAi = async () => {
    if (playingPreviewId === "main-transcript") {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewId(null);
      return;
    }
    const textToRead = mainTranscript.trim() || questions.map((q) => q.prompt).join(". ");
    if (!textToRead) {
      setSynthesizeAudioError("Chưa có kịch bản âm thanh để nghe thử!");
      return;
    }
    setSynthesizeAudioError(null);
    setPlayingPreviewId("main-transcript");
    try {
      let urlToPlay = mainAudioUrl;
      if (!urlToPlay) {
        const res = await teacherApi.synthesizeAudio({
          text: textToRead,
          voice: ttsVoice,
          speed: ttsSpeed,
        });
        urlToPlay = res.data?.data || (res as any).data;
        if (urlToPlay) {
          setMainAudioUrl(urlToPlay);
          setQuestions((prev) => prev.map((q) => ({ ...q, referenceAudioUrl: urlToPlay })));
        }
      }
      if (urlToPlay) {
        const audio = new Audio(resolvePlayableUrl(urlToPlay));
        previewAudioRef.current = audio;
        audio.onended = () => setPlayingPreviewId(null);
        audio.onerror = () => setPlayingPreviewId(null);
        await audio.play();
      } else {
        setPlayingPreviewId(null);
      }
    } catch (e: any) {
      setPlayingPreviewId(null);
      setSynthesizeAudioError("Không thể phát thử giọng đọc: " + (e.response?.data?.message || e.message));
    }
  };

  const handlePreviewAudio = async (q: QuestionDraft) => {
    if (playingPreviewId === q.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewId(null);
      return;
    }

    if (assignmentType === "LISTENING" || assignmentType === "SPEAKING") {
      const textToSpeak = (assignmentType === "SPEAKING" ? q.prompt : (q.transcript || mainTranscript || q.prompt))
        .replace(/\[.*?\]/g, "")
        .replaceAll("_+", "blank")
        .trim();
      if (!textToSpeak) return;

      setPlayingPreviewId(q.id);
      try {
        let playUrl = q.referenceAudioUrl || (assignmentType === "LISTENING" ? mainAudioUrl : "");
        if (playUrl && playUrl.includes("translate.google")) {
          playUrl = "";
        }
        if (!playUrl) {
          const res = await teacherApi.synthesizeAudio({
            text: textToSpeak,
            voice: ttsVoice,
            speed: ttsSpeed,
          });
          playUrl = res.data?.data || (res as any).data;
          if (playUrl) {
            handleUpdateQuestion(q.id, "referenceAudioUrl", playUrl);
          }
        }
        if (playUrl) {
          const audio = new Audio(resolvePlayableUrl(playUrl));
          previewAudioRef.current = audio;
          audio.onended = () => setPlayingPreviewId(null);
          audio.onerror = () => setPlayingPreviewId(null);
          await audio.play();
        } else {
          setPlayingPreviewId(null);
        }
      } catch (e) {
        console.warn("Lỗi phát thử audio:", e);
        setPlayingPreviewId(null);
      }
      return;
    }

    // Cho VOCABULARY:
    const rawTarget = q.targetWord || q.correctAnswer || q.prompt;
    const cleanWord = rawTarget.replace(/\[.*?\]/g, "").replace(/[^a-zA-Z\s-]/g, "").trim();
    const reliableUrl = cleanWord
      ? `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=2`
      : "";

    let playUrl = q.referenceAudioUrl;
    if (!playUrl || playUrl.includes("api.dictionaryapi.dev")) {
      playUrl = reliableUrl;
      if (reliableUrl) {
        handleUpdateQuestion(q.id, "referenceAudioUrl", reliableUrl);
      }
    }

    setPlayingPreviewId(q.id);
    if (playUrl) {
      const audio = new Audio(playUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setPlayingPreviewId(null);
      audio.onerror = () => setPlayingPreviewId(null);
      audio.play().catch(() => setPlayingPreviewId(null));
    } else {
      setPlayingPreviewId(null);
    }
  };

  const handleFinalSave = async () => {
    if (!title.trim()) {
      alert("Vui lòng nhập tiêu đề bài tập!");
      return;
    }

    setIsSaving(true);
    try {
      const isShadowing =
        assignmentType === "SPEAKING" &&
        (speakingMode === "SHADOWING" || selectedSubFormat.includes("SHADOWING"));

      // 1. Tạo Assignment trong hệ thống
      const createdAssign: any = await teacherApi.createAssignment({
        classroomId: classId,
        title: title.trim(),
        description: `${readingPassageText.trim() ? `[READING PASSAGE]\n${readingPassageText.trim()}\n\n` : ""}${description}\n\n[Loại: ${assignmentType}${
          assignmentType === "SPEAKING"
            ? isShadowing
              ? " - Shadowing"
              : " - Hỏi Đáp Phỏng Vấn"
            : ""
        }] [Trình độ: ${aiLevel}] [Độ khó: ${difficulty}] [Dự kiến: ${estimatedMinutes}p] [Đối tượng: ${
          targetStudents === "ALL" ? "Tất cả học sinh" : "Học sinh cần cải thiện"
        }]`,
        skillType:
          assignmentType === "SPEAKING"
            ? "SPEAKING"
            : assignmentType === "WRITING"
            ? "WRITING"
            : assignmentType === "READING"
            ? "READING"
            : assignmentType === "VOCABULARY"
            ? "VOCABULARY"
            : assignmentType === "GRAMMAR"
            ? "GRAMMAR"
            : "LISTENING",
        timeLimitMinutes: estimatedMinutes,
        dueDate: new Date(dueDate).toISOString(),
        audioUrl: assignmentType === "LISTENING" ? (mainAudioUrl || undefined) : undefined,
        listeningScript: assignmentType === "LISTENING" ? (mainTranscript || undefined) : undefined,
        questions: questions.map((q) => {
          const cleanShadowText = isShadowing
            ? (q.correctAnswer || q.prompt || "").trim()
            : q.prompt;
          return {
            promptText: isShadowing ? cleanShadowText : q.prompt,
            questionType: q.questionType,
            correctAnswer: isShadowing ? cleanShadowText : q.correctAnswer,
            mediaUrl:
              assignmentType === "VOCABULARY" || assignmentType === "SPEAKING"
                ? q.referenceAudioUrl || undefined
                : undefined,
            transcript:
              assignmentType === "VOCABULARY" || assignmentType === "SPEAKING"
                ? q.transcript || undefined
                : undefined,
            explanation: q.explanation || "",
            options:
              q.questionType === "MULTIPLE_CHOICE"
                ? q.options.map((opt) => ({
                    optionText: opt,
                    isCorrect: opt === q.correctAnswer,
                  }))
                : q.questionType === "TRUE_FALSE"
                ? [
                    { optionText: "TRUE", isCorrect: q.correctAnswer?.toUpperCase() === "TRUE" },
                    { optionText: "FALSE", isCorrect: q.correctAnswer?.toUpperCase() === "FALSE" },
                    { optionText: "NOT GIVEN", isCorrect: q.correctAnswer?.toUpperCase() === "NOT GIVEN" },
                  ]
                : [],
          };
        }),
      });

      const assignId = createdAssign.data?.data?.id || createdAssign.data?.id || createdAssign.id;

      // 2. Tự động liên kết bài tập này vào Lộ trình Ngày học (Daily Plan) tương ứng
      let targetPlan: any = null;
      if (selectedPlanId && selectedPlanId !== "NEW_DAY") {
        targetPlan = dailyPlans.find((p: any) => p.id === selectedPlanId);
      }

      if (!targetPlan) {
        const plansRes: any = await teacherApi.getDailyPlans(classId);
        const existingPlans = plansRes.data?.data || [];
        targetPlan = existingPlans.find((p: any) => p.scheduledDate === scheduledDate);

        if (!targetPlan) {
          const newDayRes: any = await teacherApi.createDailyPlan(classId, {
            dayNumber: existingPlans.length + 1,
            title: `DAY ${existingPlans.length + 1}: ${title.trim()}`,
            scheduledDate,
            estimatedMinutes,
          });
          targetPlan = newDayRes.data?.data || newDayRes.data;
        }
      }

      if (targetPlan?.id) {
        const subs = SUB_PARTS_CONFIG[assignmentType] || [];
        const currentSub = subs.find((s) => s.code === selectedSubFormat) || subs[0];
        const subLabel = currentSub ? currentSub.shortLabel : assignmentType;

        const skillIcons: Record<string, string> = {
          GRAMMAR: "🧩",
          LISTENING: "🎧",
          READING: "📖",
          VOCABULARY: "📚",
          SPEAKING: "🎙️",
          WRITING: "✍️",
        };
        const skillIcon = skillIcons[assignmentType] || "📝";
        const sectionName = `${skillIcon} ${assignmentType}: ${subLabel}`;

        await teacherApi.addPlanItem(targetPlan.id, {
          sectionName,
          title: title.trim(),
          itemType: assignmentType,
          orderIndex: (targetPlan.items?.length || 0) + 1,
          assignmentId: assignId,
        });
      }

      alert("🎉 Đã tạo và gán bài tập thành công vào lộ trình!");
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Đã xảy ra lỗi khi tạo và gán bài tập.";
      alert(`Không thể tạo bài tập:\n${errorMsg}`);
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Tạo & Gán Bài Tập Theo Ngày Học
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bước {step} / 3:{" "}
                {step === 1
                  ? "Chọn Loại & Nguồn Tạo"
                  : step === 2
                  ? "Biên Soạn Câu Hỏi (AI / Thủ Công)"
                  : "Cấu Hình Ngày Học & Giao Lớp"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 text-xs text-center font-bold">
          <div
            className={`py-2.5 transition border-r border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 ${
              step === 1 ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <span className="h-5 w-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Loại & Nguồn Bài</span>
          </div>
          <div
            className={`py-2.5 transition border-r border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 ${
              step === 2 ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <span className="h-5 w-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Biên Soạn Nội Dung</span>
          </div>
          <div
            className={`py-2.5 transition flex items-center justify-center gap-2 ${
              step === 3 ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <span className="h-5 w-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Lịch Học & Giao Lớp</span>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {/* ================= BƯỚC 1: CHỌN LOẠI & NGUỒN ================= */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Thông báo lỗi AI nếu có */}
              {aiError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start justify-between gap-3 text-xs text-rose-300 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-200">Lỗi tạo bài tập từ AI:</p>
                      <p className="mt-0.5 text-rose-300 leading-relaxed">{aiError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiError(null)}
                    className="text-rose-400 hover:text-white transition p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* 1. Chọn loại bài tập (Card Components) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  1. Chọn Loại Bài Tập (Skill Type)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "SPEAKING",
                      label: "Speaking (Luyện Nói)",
                      sub: "Hỗ trợ Shadowing AI",
                      icon: Mic,
                      color: "border-rose-500/30 text-rose-400 bg-rose-500/5",
                    },
                    {
                      id: "VOCABULARY",
                      label: "Vocabulary (Từ Vựng)",
                      sub: "Flashcards & Spaced Repetition",
                      icon: Sparkles,
                      color: "border-amber-500/30 text-amber-400 bg-amber-500/5",
                    },
                    {
                      id: "READING",
                      label: "Reading (Đọc Hiểu)",
                      sub: "Đoạn văn & Highlighting",
                      icon: BookOpen,
                      color: "border-indigo-500/30 text-indigo-400 bg-indigo-500/5",
                    },
                    {
                      id: "LISTENING",
                      label: "Listening (Nghe Hiểu)",
                      sub: "Audio player & Tốc độ",
                      icon: Headphones,
                      color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
                    },
                    {
                      id: "WRITING",
                      label: "Writing (Viết Tự Luận)",
                      sub: "AI Chấm Task 1 & Task 2",
                      icon: PenTool,
                      color: "border-sky-500/30 text-sky-400 bg-sky-500/5",
                    },
                    {
                      id: "GRAMMAR",
                      label: "Grammar (Ngữ Pháp)",
                      sub: "Điền từ & Trắc nghiệm",
                      icon: CheckSquare,
                      color: "border-purple-500/30 text-purple-400 bg-purple-500/5",
                    },
                  ].map((typeItem) => {
                    const IconComp = typeItem.icon;
                    const isSelected = assignmentType === typeItem.id;
                    return (
                      <button
                        key={typeItem.id}
                        type="button"
                        onClick={() => {
                          const nextSubs = getLevelQuestionFormats(typeItem.id, aiLevel);
                          const defaultSub = nextSubs[0]?.code || "";
                          setAssignmentType(typeItem.id as any);
                          setSelectedSubFormat(defaultSub);
                          setReadingPassageText("");
                          setMainTranscript("");
                          setMainAudioUrl("");
                          if (typeItem.id === "SPEAKING") {
                            setSpeakingMode(defaultSub === "SPEAKING_SHADOWING" ? "SHADOWING" : "QA");
                          }
                          if (typeItem.id === "WRITING") {
                            setWritingTaskType(defaultSub === "WRITING_IELTS_TASK1" ? "TASK_1" : "TASK_2");
                          }
                          updateTopicSuggestion(typeItem.id, aiLevel, defaultSub);
                        }}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-600/15 ring-2 ring-indigo-500/30"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`p-2 rounded-lg border ${typeItem.color}`}
                          >
                            <IconComp className="h-5 w-5" />
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {typeItem.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {typeItem.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1.1. Chọn Dạng Bài / Định Dạng Câu Hỏi Phù Hợp Trình Độ (Sub-task Format) */}
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-slate-50 dark:bg-slate-900/90 p-4 space-y-3 shadow-sm dark:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-indigo-100 dark:border-indigo-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-bold text-xs text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                      1.1. Chọn Trình Độ & Định Dạng Câu Hỏi ({assignmentType} • {aiLevel})
                    </span>
                  </div>
                  {/* Thanh chọn nhanh Trình độ (Đồng bộ 2 chiều với Studio bên dưới) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mr-1">Trình độ:</span>
                    {["A1", "A2", "B1", "B2", "C1", "IELTS"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleSelectLevel(lvl)}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition cursor-pointer ${
                          aiLevel === lvl
                            ? "bg-indigo-600 text-white font-bold shadow-xs scale-105"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700"
                        }`}
                        title={`Chọn trình độ ${lvl}`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Các định dạng câu hỏi chuẩn cho trình độ <b className="text-indigo-600 dark:text-indigo-300">{aiLevel}</b> (Bấm chọn dạng bài):
                  </span>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium border border-indigo-100 dark:border-transparent">
                    Đang chọn: {currentLevelFormats.find((f) => f.code === selectedSubFormat)?.label?.split("(")[0]?.trim() || "Mặc định"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {currentLevelFormats.map((subItem) => {
                    const isSubSelected = selectedSubFormat === subItem.code;
                    return (
                      <button
                        key={subItem.code}
                        type="button"
                        onClick={() => handleSelectSubFormat(subItem.code)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSubSelected
                            ? "border-indigo-500 bg-indigo-50/90 dark:bg-indigo-600/20 ring-1 ring-indigo-400/50 shadow-sm"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`font-bold text-xs flex items-center gap-1.5 ${isSubSelected ? "text-indigo-700 dark:text-indigo-200" : "text-slate-800 dark:text-slate-200"}`}>
                            <span className={`h-2 w-2 rounded-full ${isSubSelected ? "bg-indigo-500 animate-pulse" : "bg-slate-400 dark:bg-slate-600"}`}></span>
                            {subItem.label}
                          </span>
                          {isSubSelected && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {subItem.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Chọn Nguồn Nội Dung Bài Tập (AI, TEXT_AI, EXCEL, MANUAL) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    2. Phương Thức Khởi Tạo Bài Tập
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreationSource(creationSource === "RESOURCE" ? "AI" : "RESOURCE")}
                    className={`text-[11px] font-semibold flex items-center gap-1 transition ${
                      creationSource === "RESOURCE"
                        ? "text-indigo-600 dark:text-indigo-400 font-bold"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <FileText className="h-3 w-3" />
                    <span>{creationSource === "RESOURCE" ? "Quay lại các phương thức chính" : "Chọn từ tài liệu bài giảng đã tải"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Option 1: AI Tự động */}
                  <button
                    type="button"
                    onClick={() => setCreationSource("AI")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      creationSource === "AI"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Sparkles className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                          AI Auto
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Tạo Bằng AI</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        AI tự động phân tích & sinh bài tập chuẩn CEFR.
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Dán Text thô (AI định dạng chuẩn) */}
                  <button
                    type="button"
                    onClick={() => setCreationSource("TEXT_AI")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      creationSource === "TEXT_AI"
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-600/15 ring-1 ring-sky-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Type className="h-5 w-5 text-sky-500 dark:text-sky-400" />
                        <span className="text-[10px] bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">
                          Smart Text
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Dán Text Thô</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Dán văn bản, đề thi Word/PDF, AI tự định dạng vào DB.
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Nhập từ File Excel */}
                  <button
                    type="button"
                    onClick={() => setCreationSource("EXCEL")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      creationSource === "EXCEL"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-600/15 ring-1 ring-emerald-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                          Nhanh
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Nhập File Excel</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Tải lên Excel/CSV tất cả 6 kỹ năng để giao nhanh.
                      </div>
                    </div>
                  </button>

                  {/* Option 4: Soạn thủ công */}
                  <button
                    type="button"
                    onClick={() => setCreationSource("MANUAL")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      creationSource === "MANUAL"
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-600/15 ring-1 ring-purple-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Edit3 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                          Tự soạn
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Soạn Thủ Công</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Tự soạn câu hỏi & tải file audio MP3/WAV từ máy tính.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Chi tiết cho Option TEXT_AI (Dán Text thô) */}
              {creationSource === "TEXT_AI" && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3.5 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-sky-400" />
                      <span className="text-xs font-bold text-sky-200">
                        Dán Đề Thi Thô / Bài Đọc / Kịch Bản Nghe (AI Tự Động Định Dạng Đúng Chuẩn Database)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-md self-start sm:self-auto">
                      Kỹ năng: {assignmentType}
                    </span>
                  </div>

                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Dán nội dung đề bài vào đây...\n• Ví dụ 1: Copy đề trắc nghiệm từ file Word/PDF: "Câu 1: What is the main idea...? A. ... B. ... C. ... D. ... Đáp án: A. Giải thích: ..."\n• Ví dụ 2: Dán một đoạn văn bản hoặc kịch bản nghe, AI sẽ tự động tạo bài nghe dài liên tục và trích xuất câu hỏi trắc nghiệm hoặc điền từ chuẩn định dạng!`}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-hidden font-mono leading-relaxed"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Trình độ mục tiêu (CEFR):
                      </label>
                      <select
                        value={aiLevel}
                        onChange={(e) => setAiLevel(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-sky-500"
                      >
                        <option value="A1">A1 - Sơ cấp (Beginner)</option>
                        <option value="A2">A2 - Cơ bản (Elementary)</option>
                        <option value="B1">B1 - Trung cấp (Intermediate)</option>
                        <option value="B2">B2 - Trung cao (Upper-Intermediate)</option>
                        <option value="C1">C1 - Cao cấp (Advanced)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Số lượng câu hỏi mong muốn:
                      </label>
                      <select
                        value={aiQuestionCount}
                        onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-sky-500"
                      >
                        <option value={3}>3 câu</option>
                        <option value={5}>5 câu</option>
                        <option value={10}>10 câu</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    💡 Bấm nút &quot;Tiếp Tục&quot; bên dưới, AI sẽ tự phân tích và chuyển đổi văn bản trên thành danh sách câu hỏi chuẩn 100% để bạn kiểm tra ở Bước 2.
                  </p>
                </div>
              )}

              {/* Chi tiết cho Option EXCEL (Nhập File Excel) */}
              {creationSource === "EXCEL" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                      <div>
                        <h4 className="text-xs font-bold text-emerald-200">
                          Nhập Đề Thi Nhanh Từ File Excel (.xlsx, .xls, .csv)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Hỗ trợ đầy đủ tất cả 6 kỹ năng: Vocabulary, Grammar, Reading, Listening, Writing, Speaking
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Tải File Mẫu Excel Chuẩn (.xlsx)</span>
                    </button>
                  </div>

                  <label className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/80 rounded-xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer bg-slate-950/60 hover:bg-emerald-500/10 transition group text-center">
                    <UploadCloud className="h-8 w-8 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-xs font-bold text-emerald-300">
                        Bấm vào đây để chọn File Excel từ máy tính của bạn
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hỗ trợ file .xlsx, .xls hoặc .csv (Hệ thống sẽ nạp trực tiếp vào danh sách câu hỏi)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleImportExcelFile}
                      className="hidden"
                    />
                  </label>

                  <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 space-y-1.5 text-[11px] text-slate-300">
                    <span className="font-bold text-emerald-400 block">Quy chuẩn các cột trong bảng Excel:</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[10px] text-slate-400">
                      <div>• <b className="text-slate-300">STT</b>: Số thứ tự</div>
                      <div>• <b className="text-slate-300">Kỹ năng</b>: VOCABULARY, LISTENING...</div>
                      <div>• <b className="text-slate-300">Dạng câu hỏi</b>: MULTIPLE_CHOICE, FILL_IN_BLANK...</div>
                      <div>• <b className="text-slate-300">Đề bài</b>: Nội dung câu hỏi</div>
                      <div>• <b className="text-slate-300">Lựa chọn A, B, C, D</b>: Các phương án</div>
                      <div>• <b className="text-slate-300">Đáp án đúng</b>: Đáp án chính xác</div>
                      <div>• <b className="text-slate-300">Giải thích</b>: Lời giải chi tiết</div>
                      <div>• <b className="text-slate-300">Kịch bản nghe</b>: Toàn bộ đoạn nghe dài</div>
                      <div>• <b className="text-slate-300">Từ vựng / IPA</b>: Dành cho Vocabulary</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chi tiết cho Option MANUAL (Soạn thủ công) */}
              {creationSource === "MANUAL" && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200">
                      Soạn Bài Thủ Công Bằng Tay (Có Hỗ Trợ Tải File Audio Lên Từ Máy Tính)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Bạn có thể tự tay tạo từng câu hỏi, nhập đáp án đúng, thêm giải thích chi tiết, hoặc tải lên file âm thanh (MP3, WAV) từ máy tính cho bài nghe/nói ở bước tiếp theo.
                  </p>
                  {assignmentType === "LISTENING" && (
                    <div className="rounded-lg bg-slate-950/80 border border-purple-500/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-purple-300 block">Đính kèm File Audio Toàn Bài Nghe:</span>
                        <span className="text-[11px] text-slate-400">
                          {mainAudioUrl ? `Đã có file audio: ${mainAudioUrl.split("/").pop()}` : "Bạn có thể chọn file audio ngay bây giờ hoặc ở bước soạn câu hỏi."}
                        </span>
                      </div>
                      <label className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs">
                        {isUploadingAudio ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        <span>{mainAudioUrl ? "Thay đổi File Audio" : "Tải lên File Audio (.mp3, .wav)"}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={isUploadingAudio}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadMainAudio(f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Chi tiết cho Option RESOURCE */}
              {creationSource === "RESOURCE" && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">
                    Chọn bài giảng / tài liệu nguồn:
                  </span>
                  {globalResources.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Chưa có tài liệu nào được đăng tải trong lớp này.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {globalResources.map((res) => (
                        <label
                          key={res.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-200 cursor-pointer hover:border-slate-700"
                        >
                          <span className="font-semibold">{res.name}</span>
                          <input
                            type="checkbox"
                            checked={selectedResourceIds.includes(res.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedResourceIds([
                                  ...selectedResourceIds,
                                  res.id,
                                ]);
                              } else {
                                setSelectedResourceIds(
                                  selectedResourceIds.filter(
                                    (id) => id !== res.id,
                                  ),
                                );
                              }
                            }}
                            className="h-4 w-4 accent-indigo-600 rounded"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Chi tiết cho Option C (AI) */}
              {creationSource === "AI" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">
                        Chủ đề bài tập (Topic):
                      </label>
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder="Vd: IELTS Speaking Part 2 - Environment"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
                        Mức độ khó (Trình độ CEFR / IELTS):
                      </label>
                      <select
                        value={aiLevel}
                        onChange={(e) => handleSelectLevel(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        <option value="A1">A1 - Sơ cấp (Beginner)</option>
                        <option value="A2">A2 - Cơ bản (Elementary)</option>
                        <option value="B1">B1 - Trung cấp (Intermediate)</option>
                        <option value="B2">B2 - Trung cao (Upper-Intermediate)</option>
                        <option value="C1">C1 - Cao cấp (Advanced)</option>
                        <option value="IELTS">IELTS - Luyện thi IELTS Chuyên sâu</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
                        Số lượng câu hỏi:
                      </label>
                      <select
                        value={aiQuestionCount}
                        onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        <option value={3}>3 câu</option>
                        <option value={5}>5 câu</option>
                        <option value={10}>10 câu</option>
                        <option value={15}>15 câu</option>
                      </select>
                    </div>

                    {/* KHUNG HIỂN THỊ CHI TIẾT ĐỊNH DẠNG THEO TRÌNH ĐỘ (ĐỒNG BỘ 2 CHIỀU VỚI MỤC 1.1) */}
                    <div className="md:col-span-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-500/20 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                            {aiLevel}
                          </span>
                          <span className="font-bold text-xs text-indigo-700 dark:text-indigo-200">
                            Định Dạng Câu Hỏi Phù Hợp Trình Độ: {assignmentType} ({aiLevel})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {aiLevel === "A1" || aiLevel === "A2"
                            ? "Trình độ nền tảng • Dữ kiện trực quan"
                            : aiLevel === "B1" || aiLevel === "B2"
                            ? "Trình độ trung cấp • Paraphrasing & Phân tích"
                            : "Trình độ học thuật • Mô phỏng chuẩn đề thi"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          Danh sách định dạng câu hỏi cho {aiLevel} (Đồng bộ 2 chiều với Mục 1.1):
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-medium">
                          Đang chọn: {currentLevelFormats.find((f) => f.code === selectedSubFormat)?.label || "Mặc định"}
                        </span>
                      </div>

                      {/* LƯỚI CÁC ĐỊNH DẠNG CÂU HỎI CÓ THỂ CHỌN ĐƯỢC */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {currentLevelFormats.map((fmt) => {
                          const isFormatActive = selectedSubFormat === fmt.code;
                          return (
                            <button
                              key={fmt.code}
                              type="button"
                              onClick={() => handleSelectSubFormat(fmt.code)}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isFormatActive
                                  ? "bg-indigo-50/90 dark:bg-indigo-600/25 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-400/50 shadow-md scale-[1.01]"
                                  : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                  className={`text-xs font-bold ${
                                    isFormatActive ? "text-indigo-700 dark:text-indigo-200" : "text-slate-900 dark:text-white"
                                  }`}
                                >
                                  {fmt.label}
                                </span>
                                {isFormatActive && (
                                  <span className="p-0.5 rounded-full bg-indigo-600 text-white shrink-0">
                                    <Check className="h-3.5 w-3.5 font-bold" />
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                {fmt.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* ĐỐI VỚI READING IELTS: HỖ TRỢ CHỌN PASSAGE 1 / 2 / 3 */}
                      {assignmentType === "READING" && aiLevel === "IELTS" && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-500/20 text-xs">
                          <span className="text-slate-700 dark:text-slate-300 font-bold">Chọn Passage Đọc Hiểu IELTS:</span>
                          <div className="flex items-center gap-1.5">
                            {([1, 2, 3] as const).map((pNum) => (
                              <button
                                key={pNum}
                                type="button"
                                onClick={() => {
                                  setReadingPassageIelts(pNum);
                                  updateTopicSuggestion("READING", aiLevel, undefined, pNum);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                  readingPassageIelts === pNum
                                    ? "bg-indigo-600 text-white border-indigo-400"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                Passage {pNum}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Gán vào Ngày Học (Daily Study Plan):
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <select
                          value={selectedPlanId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedPlanId(val);
                            if (val !== "NEW_DAY") {
                              const plan = dailyPlans.find((p: any) => p.id === val);
                              if (plan) setScheduledDate(plan.scheduledDate);
                            }
                          }}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                        >
                          {dailyPlans.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              Day {p.dayNumber} ({p.scheduledDate}): {p.title || "Lộ trình ngày"}
                            </option>
                          ))}
                          <option value="NEW_DAY">+ Tạo ngày học mới (Thêm Day tiếp theo)</option>
                        </select>

                        {selectedPlanId === "NEW_DAY" && (
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= BƯỚC 2: BIÊN SOẠN CÂU HỎI (CHO PHÉP SỬA AI) ================= */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-indigo-400" />
                    Xem & Chỉnh Sửa Bộ Câu Hỏi ({questions.length} câu)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bạn có thể sửa tiêu đề, chỉnh đáp án, thêm hoặc xóa câu hỏi trước khi gán bài.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBlankQuestion}
                  className="flex items-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-bold border border-slate-700 transition"
                >
                  <Plus className="h-4 w-4 mr-1" /> Thêm Câu Hỏi
                </button>
              </div>

              {/* CẤU HÌNH ĐOẠN VĂN BÀI ĐỌC DÙNG CHUNG CHO TẤT CẢ CÂU HỎI (READING PASSAGE) */}
              {(assignmentType === "READING" || Boolean(readingPassageText)) && (
                <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/50 p-4 space-y-3.5 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-600/30 text-indigo-300">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                          Đoạn Văn Bài Đọc Dùng Chung (Reading Passage)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Đoạn văn này sẽ hiển thị ở trên cùng / bên trái bài làm của học sinh. Các câu hỏi bên dưới sẽ không bị lặp lại đoạn văn này.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                        {readingPassageText.trim() ? `${readingPassageText.trim().split(/\s+/).length} từ` : "Chưa có nội dung"}
                      </span>
                      {readingPassageText && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Bạn có chắc muốn xóa đoạn văn bài đọc này không?")) {
                              setReadingPassageText("");
                            }
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          Xóa bài đọc
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={6}
                      value={readingPassageText}
                      onChange={(e) => setReadingPassageText(e.target.value)}
                      placeholder="Nhập hoặc dán nội dung đoạn văn bài đọc (Reading Passage) tại đây..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden font-serif leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* CẤU HÌNH BÀI NGHE DÀI LIÊN TỤC CHO CẢ BÀI TẬP (LISTENING PASSAGE & AUDIO TRACK) */}
              {assignmentType === "LISTENING" && (
                <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/50 p-4 space-y-3.5 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-600/30 text-amber-300">
                        <Headphones className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                          Kịch Bản & Âm Thanh Toàn Bài Nghe (Official Listening Track)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Học sinh sẽ nghe cả đoạn bài nghe này và trả lời các câu hỏi bên dưới.
                        </p>
                      </div>
                    </div>

                    {/* Nút tải lên file audio từ máy tính & nghe thử */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-xs">
                        {isUploadingAudio ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        <span>{mainAudioUrl ? "Đổi File Audio" : "Tải lên File Audio (.mp3, .wav)"}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={isUploadingAudio}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadMainAudio(file);
                          }}
                        />
                      </label>

                      {mainAudioUrl && (
                        <button
                          type="button"
                          onClick={togglePlayMainAudio}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isPlayingMainAudio
                              ? "bg-amber-400 text-slate-950"
                              : "bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-500/30"
                          }`}
                        >
                          {isPlayingMainAudio ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          <span>{isPlayingMainAudio ? "Dừng" : "Nghe thử file"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {audioUploadSuccess && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {audioUploadSuccess}
                    </div>
                  )}

                  {mainAudioUrl && (
                    <div className="flex items-center gap-2 text-xs text-indigo-200 bg-indigo-900/30 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
                      <FileAudio className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="font-mono truncate flex-1">{mainAudioUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMainAudioUrl("");
                          setQuestions((prev) => prev.map((q) => ({ ...q, referenceAudioUrl: undefined })));
                        }}
                        className="text-slate-400 hover:text-rose-400 transition"
                        title="Xóa link audio"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Textarea kịch bản bài nghe liên tục */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-300">
                        Kịch bản đoạn nghe liên tục (Listening Passage / Audio Script):
                      </label>
                      <button
                        type="button"
                        onClick={handlePreviewTranscriptAi}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Volume2 className="h-3 w-3" />
                        {playingPreviewId === "main-transcript" ? "Đang đọc... (Bấm dừng)" : "Nghe thử giọng đọc AI"}
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={mainTranscript}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMainTranscript(val);
                      }}
                      placeholder="Nhập nội dung bài nghe hoặc hội thoại (VD: A: Hello / B: Hi)..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden font-serif leading-relaxed"
                    />
                  </div>

                  {/* Cụm công cụ Cấu hình Giọng Đọc Bài Nghe */}
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 border-b border-indigo-500/20 pb-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-300">
                        Cấu hình giọng đọc bài nghe
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Giọng đọc:
                        </label>
                        <select
                          value={ttsVoice}
                          onChange={(e) => setTtsVoice(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white outline-none focus:border-amber-400"
                        >
                          <option value="af_heart">🇺🇸 Giọng Mỹ - Nữ (Heart)</option>
                          <option value="am_michael">🇺🇸 Giọng Mỹ - Nam (Michael)</option>
                          <option value="bf_emma">🇬🇧 Giọng Anh - Nữ (Emma)</option>
                          <option value="bm_george">🇬🇧 Giọng Anh - Nam (George)</option>
                          <option value="af_bella">🇺🇸 Giọng Mỹ - Nữ (Bella)</option>
                          <option value="am_adam">🇺🇸 Giọng Mỹ - Nam (Adam)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Tốc Độ Phát (Speed):
                        </label>
                        <select
                          value={ttsSpeed}
                          onChange={(e) => setTtsSpeed(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white outline-none focus:border-amber-400"
                        >
                          <option value="0.75x">0.75x (Chậm - Dành cho sơ cấp A1/A2)</option>
                          <option value="1.0x">1.0x (Chuẩn - Tốc độ bản ngữ tự nhiên)</option>
                          <option value="1.25x">1.25x (Nhanh - Luyện phản xạ B2/C1)</option>
                          <option value="1.5x">1.5x (Rất nhanh)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={isSynthesizingTts || !mainTranscript.trim()}
                        onClick={handleSynthesizeNeuralAudio}
                        className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {isSynthesizingTts ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Đang tạo âm thanh...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>{mainAudioUrl ? "Cập nhật âm thanh" : "Tạo âm thanh"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Inline Status Banners: Loading, Error Banner with Retry, and Success */}
                    {isSynthesizingTts && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 text-amber-400" />
                        <span>Đang tổng hợp giọng đọc hội thoại (có thể mất 15–30 giây với bài nghe dài)...</span>
                      </div>
                    )}

                    {synthesizeAudioError && !isSynthesizingTts && (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                          <span>{synthesizeAudioError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSynthesizeNeuralAudio}
                          disabled={isSynthesizingTts}
                          className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold shrink-0 cursor-pointer transition border border-red-500/30"
                        >
                          Thử tạo lại ngay
                        </button>
                      </div>
                    )}

                    {audioUploadSuccess && !synthesizeAudioError && !isSynthesizingTts && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{audioUploadSuccess}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {questions.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  Chưa có câu hỏi nào. Bấm nút <b>Thêm Câu Hỏi</b> để tự tạo!
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            Câu {idx + 1} ({q.questionType})
                          </span>
                          {q.targetWord && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/20">
                              Từ: {q.targetWord}
                            </span>
                          )}
                          {q.ipa && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold border border-indigo-500/20">
                              IPA: {q.ipa}
                            </span>
                          )}
                          {assignmentType !== "LISTENING" && (assignmentType === "SPEAKING" || q.referenceAudioUrl || q.targetWord) && (
                            <button
                              type="button"
                              onClick={() => handlePreviewAudio(q)}
                              className={`px-2.5 py-0.5 rounded font-bold text-[11px] border flex items-center gap-1 transition cursor-pointer ${
                                playingPreviewId === q.id
                                  ? "bg-amber-400 text-slate-950 border-amber-400"
                                  : q.referenceAudioUrl
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/20"
                                  : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20"
                              }`}
                              title="Nghe thử phát âm mẫu"
                            >
                              <Volume2 className="h-3 w-3" />
                              {playingPreviewId === q.id
                                ? "Đang phát..."
                                : q.referenceAudioUrl
                                ? "Nghe phát âm mẫu"
                                : "Tạo & Nghe thử"}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 transition"
                          title="Xóa câu này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          {assignmentType === "SPEAKING"
                            ? speakingMode === "QA"
                              ? "Câu hỏi phỏng vấn Speaking (Question Prompt in English):"
                              : "Câu văn mẫu luyện Shadowing (Target Sentence to Shadow):"
                            : assignmentType === "WRITING"
                            ? q.questionType === "FILL_IN_BLANK"
                              ? "Đề bài sắp xếp từ / hoàn thành câu (Writing Prompt):"
                              : "Đề bài viết đoạn văn / bài luận (Writing Prompt):"
                            : "Nội dung câu hỏi (Question Prompt):"}
                        </label>
                        <textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, "prompt", e.target.value)
                          }
                          placeholder={
                            assignmentType === "SPEAKING" && speakingMode === "QA"
                              ? "Vd: What are the main benefits of learning foreign languages?"
                              : assignmentType === "WRITING" && q.questionType === "FILL_IN_BLANK"
                              ? "Vd: Sắp xếp các từ sau thành câu hoàn chỉnh: always / to school / by bus / She / goes"
                              : "Nhập nội dung câu hỏi..."
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* SPEAKING Q&A: Khung cấu hình chấm Task Response (Ý chính cần trả lời) */}
                      {assignmentType === "SPEAKING" && speakingMode === "QA" && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                              Ý chính cần trả lời (AI đối chiếu chấm Task Response - Đúng trọng tâm / Lạc đề):
                            </label>
                            <textarea
                              rows={2}
                              value={q.correctAnswer}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
                              }
                              placeholder="Vd: Nêu ít nhất 2 lợi ích: mở rộng cơ hội việc làm, hiểu biết văn hoá thế giới, rèn luyện tư duy não bộ..."
                              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                              💡 Gợi ý trả lời & Dàn ý / Từ vựng cho học sinh (Hint & Vocabulary):
                            </label>
                            <textarea
                              rows={2}
                              value={q.explanation || ""}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, "explanation", e.target.value)
                              }
                              placeholder="Vd: Từ vựng gợi ý: cognitive skills, global perspective, career advancement..."
                              className="w-full rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-400 placeholder:text-slate-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* SPEAKING SHADOWING: Dịch nghĩa & hướng dẫn phát âm */}
                      {assignmentType === "SPEAKING" && speakingMode === "SHADOWING" && (
                        <div className="space-y-2 pt-1">
                          <label className="block text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                            Dịch nghĩa tiếng Việt & Ghi chú phát âm (Linking / Stress notes):
                          </label>
                          <textarea
                            rows={2}
                            value={q.explanation || ""}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, "explanation", e.target.value)
                            }
                            placeholder="Vd: Dịch nghĩa và lưu ý nối âm..."
                            className="w-full rounded-lg border border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 p-2.5 text-xs text-indigo-900 dark:text-indigo-200 outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}

                      {/* WRITING: Bài mẫu & Tiêu chí chấm (Chỉ hiển thị cho ESSAY) */}
                      {assignmentType === "WRITING" && q.questionType === "ESSAY" && (
                        <div className="space-y-2 pt-1">
                          <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                            Bài mẫu tham khảo / Dàn ý & Tiêu chí chấm (AI đối chiếu chấm Task Response):
                          </label>
                          <textarea
                            rows={3}
                            value={q.correctAnswer}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
                            }
                            placeholder="Vd: Đoạn văn mẫu, luận điểm 1, luận điểm 2, kết luận..."
                            className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
                          />
                        </div>
                      )}

                      {q.questionType === "MULTIPLE_CHOICE" && (
                        <div className="space-y-2 pt-1">
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Các lựa chọn đáp án (nhấn nút chữ cái để đánh dấu đáp án đúng):
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = q.correctAnswer === opt;
                              return (
                                <div
                                  key={oIdx}
                                  className={`flex items-center space-x-2 rounded-lg border p-1.5 transition ${
                                    isCorrect
                                      ? "border-emerald-500/50 bg-emerald-500/10"
                                      : "border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateQuestion(q.id, "correctAnswer", opt)
                                    }
                                    title="Đặt làm đáp án đúng"
                                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition shrink-0 ${
                                      isCorrect
                                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oIdx)}
                                  </button>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...q.options];
                                      const oldVal = newOpts[oIdx];
                                      newOpts[oIdx] = e.target.value;
                                      handleUpdateQuestion(q.id, "options", newOpts);
                                      if (q.correctAnswer === oldVal) {
                                        handleUpdateQuestion(
                                          q.id,
                                          "correctAnswer",
                                          e.target.value,
                                        );
                                      }
                                    }}
                                    className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {q.questionType === "FILL_IN_BLANK" && (
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {assignmentType === "WRITING"
                              ? "Câu hoàn chỉnh mẫu / Đáp án chính xác (Model Sentence):"
                              : "Đáp án chính xác cần điền (Correct word / phrase):"}
                          </label>
                          <input
                            type="text"
                            value={q.correctAnswer}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
                            }
                            placeholder={
                              assignmentType === "WRITING"
                                ? "Nhập câu tiếng Anh hoàn chỉnh mẫu (Vd: She always goes to school by bus.)..."
                                : "Nhập từ hoặc cụm từ đáp án chính xác..."
                            }
                            className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 placeholder:text-slate-500"
                          />
                        </div>
                      )}

                      {q.questionType === "TRUE_FALSE" && (
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                            Đáp án đúng (TRUE / FALSE / NOT GIVEN):
                          </label>
                          <div className="flex gap-2">
                            {["TRUE", "FALSE", "NOT GIVEN"].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleUpdateQuestion(q.id, "correctAnswer", val)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                                  q.correctAnswer?.toUpperCase() === val
                                    ? "bg-sky-500 text-slate-950 border-sky-400 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700"
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {q.explanation && assignmentType !== "SPEAKING" && (
                        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 p-2.5 text-xs text-indigo-800 dark:text-indigo-300">
                          <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                            💡 Gợi ý / Giải thích AI:{" "}
                          </span>
                          {q.explanation}
                        </div>
                      )}

                      {/* Cấu hình Audio phát âm từ vựng (CHỈ cho VOCABULARY) */}
                      {assignmentType === "VOCABULARY" && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <Volume2 className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                              Audio phát âm từ vựng chuẩn (Native US Voice / Youdao CDN):
                            </label>
                            <button
                              type="button"
                              onClick={() => handlePreviewAudio(q)}
                              className={`px-3 py-1 rounded text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                playingPreviewId === q.id
                                  ? "bg-amber-800 ring-2 ring-amber-400"
                                  : "bg-amber-600 hover:bg-amber-500"
                              }`}
                            >
                              <Volume2 className={`h-3.5 w-3.5 ${playingPreviewId === q.id ? "animate-bounce" : ""}`} />
                              {playingPreviewId === q.id ? "Đang phát..." : "Nghe thử phát âm từ"}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={q.referenceAudioUrl || ""}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, "referenceAudioUrl", e.target.value)
                            }
                            placeholder="Link audio MP3 từ điển (Vd: https://dict.youdao.com/dictvoice?...)"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-amber-700 dark:text-amber-200 outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= BƯỚC 3: CẤU HÌNH GÁN BÀI & THỜI GIAN ================= */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu Đề Bài Tập:
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề bài tập..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mức Độ Khó:
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  >
                    <option value="EASY">Dễ (Easy)</option>
                    <option value="MEDIUM">Trung bình (Medium)</option>
                    <option value="HARD">Khó (Hard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô Tả / Hướng Dẫn Học Sinh:
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập hướng dẫn làm bài cho học viên..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Lộ Trình Ngày Học (Daily Study Plan) & Deadline */}
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Gán vào Ngày Học (Daily Study Plan trong Lộ Trình Lớp):
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={selectedPlanId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedPlanId(val);
                        if (val !== "NEW_DAY") {
                          const plan = dailyPlans.find((p: any) => p.id === val);
                          if (plan) setScheduledDate(plan.scheduledDate);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    >
                      {dailyPlans.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          Day {p.dayNumber} ({p.scheduledDate}): {p.title || "Lộ trình ngày"}
                        </option>
                      ))}
                      <option value="NEW_DAY">+ Tạo ngày học mới (Thêm Day tiếp theo)</option>
                    </select>

                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" /> Hạn Nộp (Deadline):
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Thời Lượng Dự Kiến (Phút):
                    </label>
                    <input
                      type="number"
                      min={5}
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Đối tượng & Trạng thái */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" /> Giao Cho Đối Tượng:
                  </label>
                  <select
                    value={targetStudents}
                    onChange={(e) => setTargetStudents(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">Tất cả học sinh trong lớp</option>
                    <option value="WEAK_STUDENTS">Chỉ học sinh cần cải thiện (Cảnh báo AI)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng Thái Bài Tập:
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  >
                    <option value="PUBLISHED">Công khai & Mở bài đúng hạn (PUBLISHED)</option>
                    <option value="DRAFT">Lưu nháp (DRAFT)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/90 dark:bg-slate-900/90">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Quay Lại
            </button>
          ) : (
            <span />
          )}

          {step === 1 && (
            <button
              type="button"
              disabled={isGeneratingAi}
              onClick={() => {
                if (creationSource === "AI") {
                  handleGenerateAiQuestions();
                } else if (creationSource === "TEXT_AI") {
                  if (!rawText.trim()) {
                    alert("Vui lòng dán hoặc nhập nội dung văn bản thô!");
                    return;
                  }
                  handleGenerateAiQuestions(rawText);
                } else if (creationSource === "EXCEL") {
                  alert("Vui lòng chọn File Excel ở khung bên trên để hệ thống tự động nạp câu hỏi!");
                } else if (creationSource === "RESOURCE") {
                  if (selectedResourceIds.length === 0) {
                    alert("Vui lòng chọn ít nhất 1 tài liệu nguồn!");
                    return;
                  }
                  const selectedDocs = globalResources
                    .filter((r) => selectedResourceIds.includes(r.id))
                    .map((r) => r.name)
                    .join(", ");
                  handleGenerateAiQuestions(`Tài liệu nguồn: ${selectedDocs}`);
                } else {
                  // MANUAL
                  if (questions.length === 0) {
                    handleAddBlankQuestion();
                  }
                  setStep(2);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer disabled:opacity-50"
            >
              {isGeneratingAi ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI Đang Phân Tích & Tạo Câu Hỏi...</span>
                </>
              ) : (
                <>
                  <span>Tiếp Tục (Biên Soạn Câu Hỏi)</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer"
            >
              <span>Tiếp Tục (Cấu Hình Ngày & Giao Bài)</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleFinalSave}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang Gán & Lưu Lộ Trình...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Xác Nhận & Gán Vào Lộ Trình</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
