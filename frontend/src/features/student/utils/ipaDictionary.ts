// src/features/student/utils/ipaDictionary.ts

export type MouthShapeType =
  | "ROUNDED"          // /w/, /uː/, /ʊ/, /ɔː/, /oʊ/
  | "SPREAD"           // /iː/, /ɪ/, /e/, /eɪ/
  | "OPEN_WIDE"        // /æ/, /ɑː/, /ʌ/, /aɪ/, /aʊ/
  | "LABIODENTAL"      // /f/, /v/
  | "INTERDENTAL"      // /θ/, /ð/
  | "ALVEOLAR_TAP"     // /t/, /d/, /n/, /l/, /s/, /z/
  | "PALATAL_SIBILANT" // /ʃ/, /ʒ/, /tʃ/, /dʒ/
  | "RETROFLEX_R"      // /r/, /ɹ/, /ɜːr/
  | "NEUTRAL";         // /ə/

export interface PhonemeBreakdownItem {
  readonly ipa: string;
  readonly type: string;
  readonly tip: string;
}

export interface WordPhoneticsData {
  readonly word: string;
  readonly ipa: string;
  readonly syllables?: string;
  readonly googleRespelling?: string;
  readonly mouthShape: MouthShapeType;
  readonly mouthTitle: string;
  readonly lipGuide: string;
  readonly tongueGuide: string;
  readonly airflowGuide: string;
  readonly vietnameseTip: string;
  readonly phonemes: readonly PhonemeBreakdownItem[];
}

/**
 * Từ điển âm vị IPA & khẩu hình chuẩn mực phong cách Google cho các từ tiếng Anh phổ biến
 */
const WORD_PHONETICS_STORE: Record<string, WordPhoneticsData> = {
  walk: {
    word: "walk",
    ipa: "wɔːk",
    syllables: "walk",
    googleRespelling: "wawk",
    mouthShape: "ROUNDED",
    mouthTitle: "Khẩu hình Môi Chu Tròn & Mở Hậu (/wɔːk/)",
    lipGuide: "Chu môi tròn đón âm /w/, sau đó mở vừa tròn môi cho nguyên âm dài /ɔː/.",
    tongueGuide: "Gốc lưỡi nâng cao về phía vòm họng mềm, đầu lưỡi hạ thấp tự do, chặn hơi cuống lưỡi bật âm /k/.",
    airflowGuide: "Hữu thanh rung thanh quản ở /wɔː/, bật hơi vô thanh dứt khoát tại âm đuôi /k/.",
    vietnameseTip: "Không đọc là 'oắc' hay 'u-oóc'. Kéo dài âm tròn môi /ɔː/ sâu trong họng và bật âm /k/ nhẹ ở cuối.",
    phonemes: [
      { ipa: "w", type: "Bán nguyên âm môi-ngạc mềm", tip: "Môi chu tròn như chuẩn bị huýt sáo, dây thanh rung nhẹ." },
      { ipa: "ɔː", type: "Nguyên âm dài tròn môi", tip: "Hạ hàm vừa phải, tròn môi, tạo độ vang trầm từ cuống họng." },
      { ipa: "k", type: "Phụ âm bật hơi vô thanh", tip: "Nâng cuống lưỡi chặn ngạc mềm rồi bật mạnh luồng hơi dứt khoát." },
    ],
  },
  work: {
    word: "work",
    ipa: "wɜːrk",
    syllables: "work",
    googleRespelling: "wurk",
    mouthShape: "ROUNDED",
    mouthTitle: "Khẩu hình Môi Tròn & Cuốn Lưỡi R (/wɜːrk/)",
    lipGuide: "Môi chu tròn ở /w/, sau đó thả lỏng môi hơi chúm nhẹ khi vào âm /ɜːr/.",
    tongueGuide: "Đầu lưỡi cong ngược lên vòm họng trên (không chạm nướu) để tạo độ rền của âm R Mỹ, cuống lưỡi bật /k/.",
    airflowGuide: "Dây thanh rung đều liên tục qua /wɜːr/, kết thúc bằng luồng hơi bật sắc gọn /k/.",
    vietnameseTip: "Phân biệt rõ với 'walk' (/wɔːk/). 'Work' có âm cong lưỡi rền ở giữa (/ɜːr/), không mở to khẩu hình.",
    phonemes: [
      { ipa: "w", type: "Bán nguyên âm môi-ngạc mềm", tip: "Chu môi tròn phía trước, hơi đẩy qua khe môi tròn." },
      { ipa: "ɜːr", type: "Nguyên âm cong lưỡi rỗng giữa", tip: "Nâng thân lưỡi và cong nhẹ đầu lưỡi về sau vòm họng." },
      { ipa: "k", type: "Phụ âm bật hơi vô thanh", tip: "Bật dứt khoát âm đuôi để giữ nhịp câu." },
    ],
  },
  coffee: {
    word: "coffee",
    ipa: "ˈkɒfi",
    syllables: "cof · fee",
    googleRespelling: "KOF-ee",
    mouthShape: "LABIODENTAL",
    mouthTitle: "Khẩu hình Răng Trên Chạm Môi Dưới (/ˈkɒfi/)",
    lipGuide: "Bắt đầu với miệng mở vừa /kɒ/, sau đó răng cửa hàm trên áp nhẹ lên mép trong môi dưới phát âm /f/.",
    tongueGuide: "Cuống lưỡi nâng bật /k/, lưỡi hạ thấp cho /ɒ/, sau đó đưa đầu lưỡi lên vòm cứng cho âm /i/.",
    airflowGuide: "Bật hơi ở /k/, sau đó đẩy luồng hơi ma sát êm qua kẽ răng - môi ở /f/, kết thúc bằng nguyên âm ngân /i/.",
    vietnameseTip: "Nhấn mạnh trọng âm vào âm tiết đầu 'COF-', âm thứ hai lướt nhẹ 'fee' kéo khóe miệng sang hai bên.",
    phonemes: [
      { ipa: "k", type: "Phụ âm bật hơi vô thanh", tip: "Bật mạnh hơi ở cuống họng." },
      { ipa: "ɒ", type: "Nguyên âm ngắn mở", tip: "Hạ hàm dưới, môi hơi tròn nhẹ." },
      { ipa: "f", type: "Phụ âm xát răng-môi", tip: "Răng cửa trên chạm nhẹ môi dưới, thổi hơi đều không rung thanh quản." },
      { ipa: "i", type: "Nguyên âm căng khóe môi", tip: "Căng nhẹ mép sang hai bên như đang cười mỉm." },
    ],
  },
  grab: {
    word: "grab",
    ipa: "ɡræb",
    syllables: "grab",
    googleRespelling: "grab",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mở Rộng Hàm Chữ A Bẹt (/ɡræb/)",
    lipGuide: "Mở rộng khóe môi sang hai bên và hạ thấp hàm dưới (khẩu hình chữ A bẹt /æ/).",
    tongueGuide: "Mặt lưỡi hạ phẳng xuống sàn miệng, đầu lưỡi chạm mặt trong răng cửa dưới, mím môi chặn âm /b/.",
    airflowGuide: "Hữu thanh toàn bộ: rung dây thanh quản từ /ɡ/ qua /æ/ và khép môi nén khí ở /b/.",
    vietnameseTip: "Đừng đọc thành 'gờ-ráp'. Hãy mở rộng hàm theo chiều dọc và ngang để âm /æ/ vang tròn, mím môi nhẹ kết thúc.",
    phonemes: [
      { ipa: "ɡ", type: "Phụ âm tắc hữu thanh", tip: "Chặn hơi ở ngạc mềm rồi nhả ra với độ rung thanh quản." },
      { ipa: "r", type: "Phụ âm tiếp cận", tip: "Đầu lưỡi hơi cong nhẹ phía sau vòm nướu." },
      { ipa: "æ", type: "Nguyên âm bẹt mở rộng", tip: "Hạ hàm sâu, khóe miệng căng sang 2 bên, lưỡi nằm sát sàn miệng." },
      { ipa: "b", type: "Phụ âm tắc hai môi", tip: "Mím chặt hai môi rồi nhả nhẹ, rung dây thanh." },
    ],
  },
  usually: {
    word: "usually",
    ipa: "ˈjuːʒuəli",
    syllables: "u · su · al · ly",
    googleRespelling: "YOO-zhoo-uh-lee",
    mouthShape: "PALATAL_SIBILANT",
    mouthTitle: "Khẩu hình Chu Môi Xát Vòm Cứng (/ˈjuːʒuəli/)",
    lipGuide: "Khởi đầu chu môi tròn nhỏ cho /juː/, giữ môi chúm tròn và hơi loe ra cho âm xát /ʒ/.",
    tongueGuide: "Nâng mặt lưỡi sát ngạc cứng để tạo khe hẹp ma sát âm /ʒ/, sau đó đầu lưỡi chạm nhẹ nướu cho âm /l/.",
    airflowGuide: "Dây thanh quản rung mạnh liên tục trong suốt từ; luồng hơi ma sát rền qua khe lưỡi - vòm họng ở /ʒ/.",
    vietnameseTip: "Âm /ʒ/ ở giữa rất quan trọng, phát âm tương tự âm 'gi' trong tiếng Pháp (như 'journal'), không đọc thành /z/ hay /s/.",
    phonemes: [
      { ipa: "j", type: "Bán nguyên âm vòm", tip: "Lưỡi nâng cao sát vòm cứng, trượt nhanh sang âm /uː/." },
      { ipa: "uː", type: "Nguyên âm dài chu môi", tip: "Chu tròn môi nhỏ phía trước." },
      { ipa: "ʒ", type: "Phụ âm xát sau chân răng hữu thanh", tip: "Môi chu loe nhẹ, mặt lưỡi sát vòm miệng, thổi hơi rung dây thanh." },
      { ipa: "ə", type: "Nguyên âm schwa lướt", tip: "Thả lỏng toàn bộ cơ miệng." },
      { ipa: "li", type: "Âm tiết đuôi", tip: "Đầu lưỡi chạm nướu trên cho /l/, kéo khóe môi sang bên cho /i/." },
    ],
  },
  decided: {
    word: "decided",
    ipa: "dɪˈsaɪdɪd",
    syllables: "de · cid · ed",
    googleRespelling: "dih-SY-did",
    mouthShape: "SPREAD",
    mouthTitle: "Khẩu hình Chuyển Động Nguyên Âm Đôi /aɪ/ & Chạm Nướu /d/",
    lipGuide: "Bắt đầu với môi thả lỏng ở /dɪ/, mở rộng hàm rồi trượt căng sang hai bên cho nguyên âm đôi /aɪ/.",
    tongueGuide: "Đầu lưỡi chạm nướu răng trên 2 lần để bật âm /d/ dứt khoát, nâng mặt lưỡi trượt từ thấp lên cao ở /aɪ/.",
    airflowGuide: "Luồng hơi được ngắt và bật nhịp nhàng bởi đầu lưỡi chạm nướu tại các phụ âm /d/.",
    vietnameseTip: "Nhấn trọng âm mạnh vào âm tiết thứ 2 '-CI-' (/saɪ/). Đuôi '-ed' đọc rõ là /-ɪd/.",
    phonemes: [
      { ipa: "d", type: "Phụ âm tắc chân răng", tip: "Đầu lưỡi áp chặt vào nướu trên rồi bật nhẹ." },
      { ipa: "ɪ", type: "Nguyên âm ngắn lướt", tip: "Miệng hé nhỏ, cơ thả lỏng." },
      { ipa: "s", type: "Phụ âm xát răng vô thanh", tip: "Đẩy luồng hơi mảnh qua kẽ hai hàm răng khép hờ." },
      { ipa: "aɪ", type: "Nguyên âm đôi mở -> căng", tip: "Hạ hàm rộng ở /a/ rồi trượt nhanh môi sang hai bên ở /ɪ/." },
      { ipa: "dɪd", type: "Đuôi âm tiết kết", tip: "Bật dứt khoát /d/, lướt âm /ɪ/ và chặn nhẹ ở /d/ cuối." },
    ],
  },
  today: {
    word: "today",
    ipa: "təˈdeɪ",
    syllables: "to · day",
    googleRespelling: "tuh-DAY",
    mouthShape: "SPREAD",
    mouthTitle: "Khẩu hình Bật Nướu & Trượt Môi Căng /eɪ/",
    lipGuide: "Âm đầu thả lỏng tự nhiên, khi sang '-day' miệng mở vừa rồi căng nhẹ khóe môi sang hai bên theo âm đôi /eɪ/.",
    tongueGuide: "Đầu lưỡi chạm nướu trên bật /t/, hạ nhẹ cho âm lướt /ə/, sau đó chạm nướu bật mạnh /d/ và trượt lưỡi lên phía trước.",
    airflowGuide: "Âm /t/ đầu bật hơi vô thanh dứt khoát, âm /deɪ/ rung thanh quản ngân vang dài.",
    vietnameseTip: "Âm 'to-' đọc rất ngắn và nhẹ (schwa /tə/), không đọc là 'tu-đê'. Nhấn mạnh và kéo dài vần '-DAY' (/deɪ/).",
    phonemes: [
      { ipa: "t", type: "Phụ âm bật hơi vô thanh", tip: "Đầu lưỡi nén hơi sau nướu răng trên rồi bật dứt khoát." },
      { ipa: "ə", type: "Nguyên âm lướt schwa", tip: "Thả lỏng môi và lưỡi tối đa, phát âm thật nhanh." },
      { ipa: "d", type: "Phụ âm tắc hữu thanh", tip: "Đầu lưỡi áp nướu trên, bật ra kèm rung dây thanh." },
      { ipa: "eɪ", type: "Nguyên âm đôi lướt", tip: "Mở miệng vừa ở /e/, kéo khóe môi sang hai bên lên /ɪ/." },
    ],
  },
  instead: {
    word: "instead",
    ipa: "ɪnˈsted",
    syllables: "in · stead",
    googleRespelling: "in-STED",
    mouthShape: "SPREAD",
    mouthTitle: "Khẩu hình Môi Bè Căng & Bật Đầu Lưỡi /sted/",
    lipGuide: "Khóe miệng căng nhẹ sang hai bên, hai hàm răng khép hờ để luồng hơi xát /s/ thoát ra trước khi bật /t/.",
    tongueGuide: "Đầu lưỡi đặt sau chân răng cửa dưới cho /s/, chuyển nhanh lên nướu răng trên để bật /t/ và kết thúc ở /d/.",
    airflowGuide: "Hơi xát mịn ở /s/, nén và nhả hơi ở /t/, rung thanh quản ở nguyên âm /e/ và chặn nhẹ ở /d/.",
    vietnameseTip: "Tập trung vào cụm phụ âm đôi 'st-'. Đừng nuốt âm /s/ cũng đừng tách rời thành hai từ. Đọc liền mạch 'in-STEAD'.",
    phonemes: [
      { ipa: "ɪn", type: "Âm tiết đầu lướt", tip: "Đầu lưỡi chạm nướu cho âm mũi /n/." },
      { ipa: "s", type: "Phụ âm xát rít răng", tip: "Đẩy luồng hơi sắc qua khe răng cửa." },
      { ipa: "t", type: "Phụ âm bật hơi", tip: "Bật ngay sau âm /s/ mà không có khoảng ngừng." },
      { ipa: "e", type: "Nguyên âm ngắn mở vừa", tip: "Miệng mở vừa, căng nhẹ mép sang hai bên." },
      { ipa: "d", type: "Phụ âm đuôi", tip: "Đầu lưỡi chạm nướu trên chặn hơi nhẹ nhàng." },
    ],
  },
  way: {
    word: "way",
    ipa: "weɪ",
    syllables: "way",
    googleRespelling: "way",
    mouthShape: "ROUNDED",
    mouthTitle: "Khẩu hình Chuyển Động Tròn Môi -> Căng Mép (/weɪ/)",
    lipGuide: "Bắt đầu với hai môi chu tròn nhỏ phía trước (/w/), sau đó mở dẹt và kéo căng khóe môi sang hai bên (/eɪ/).",
    tongueGuide: "Cuống lưỡi nâng cao lúc đầu, sau đó trượt mặt lưỡi hướng lên vòm cứng phía trước.",
    airflowGuide: "Hữu thanh liên tục: thanh quản rung mạnh từ lúc chu môi đến khi kết thúc âm trượt.",
    vietnameseTip: "Chu môi thật tròn ở đầu từ như muốn huýt sáo rồi mới mở sang 'ây'. Tuyệt đối không đọc phẳng như chữ 'uây' tiếng Việt.",
    phonemes: [
      { ipa: "w", type: "Bán nguyên âm chu môi", tip: "Chu tròn môi nhỏ, luồng hơi thoát ra êm ái." },
      { ipa: "eɪ", type: "Nguyên âm đôi lướt", tip: "Trượt mượt mà từ âm /e/ sang /ɪ/ với khóe môi căng dần sang hai bên." },
    ],
  },
  on: {
    word: "on",
    ipa: "ɒn",
    syllables: "on",
    googleRespelling: "on",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mở Hàm Tròn Nhẹ & Chạm Nướu (/ɒn/)",
    lipGuide: "Mở hàm dưới xuống, môi hơi bo tròn nhẹ tạo âm /ɒ/, sau đó thả lỏng môi khi đầu lưỡi chạm nướu cho /n/.",
    tongueGuide: "Gốc lưỡi hạ thấp cho nguyên âm, sau đó đầu lưỡi áp chặt vào vòm nướu răng trên chặn hơi đưa lên khoang mũi.",
    airflowGuide: "Hơi thoát qua miệng ở nguyên âm /ɒ/, sau đó bị chặn lại ở miệng và thoát qua mũi ở phụ âm /n/.",
    vietnameseTip: "Phát âm tròn và gọn gàng, không kéo dài quá mức. Giữ đầu lưỡi áp sát nướu răng trên khi kết thúc từ.",
    phonemes: [
      { ipa: "ɒ", type: "Nguyên âm ngắn mở", tip: "Hạ hàm dưới xuống, môi bo tròn tự nhiên." },
      { ipa: "n", type: "Phụ âm mũi chân răng", tip: "Đầu lưỡi chạm nướu trên, luồng hơi dội lên khoang mũi." },
    ],
  },
  my: {
    word: "my",
    ipa: "maɪ",
    syllables: "my",
    googleRespelling: "my",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mím Môi Mở Rộng Sang Căng Khóe (/maɪ/)",
    lipGuide: "Hai môi mím nhẹ phát âm /m/, sau đó mở rộng miệng theo chiều dọc cho /a/ và khép hẹp căng khóe môi cho /ɪ/.",
    tongueGuide: "Lưỡi nằm phẳng lúc đầu, sau đó nâng mặt lưỡi trượt lên cao về phía ngạc cứng.",
    airflowGuide: "Hữu thanh toàn bộ: hơi qua mũi ở /m/, sau đó thoát mạnh qua khoang miệng mở ở nguyên âm đôi /aɪ/.",
    vietnameseTip: "Mở rộng khẩu hình ở đầu âm /a/ để từ nghe sáng và tự tin, không đọc nông như từ 'mai' tiếng Việt.",
    phonemes: [
      { ipa: "m", type: "Phụ âm mũi hai môi", tip: "Mím nhẹ hai môi, hơi dội qua khoang mũi với độ rung dây thanh." },
      { ipa: "aɪ", type: "Nguyên âm đôi mở sang căng", tip: "Hạ hàm rộng, sau đó thu hẹp trượt về phía khóe môi căng." },
    ],
  },
  to: {
    word: "to",
    ipa: "tuː",
    syllables: "to",
    googleRespelling: "too",
    mouthShape: "ROUNDED",
    mouthTitle: "Khẩu hình Bật Nướu & Chu Tròn Môi (/tuː/)",
    lipGuide: "Môi thả lỏng khi bật /t/, sau đó chu tròn nhỏ và đưa hẳn ra phía trước cho nguyên âm dài /uː/.",
    tongueGuide: "Đầu lưỡi chạm nướu trên nén khí rồi bật mạnh /t/, sau đó cuống lưỡi nâng cao về phía ngạc mềm.",
    airflowGuide: "Bật hơi vô thanh sắc nét ở /t/, tiếp nối bằng luồng hơi hữu thanh rung đều ở /uː/.",
    vietnameseTip: "Trong câu nói tự nhiên, từ này thường được phát âm lướt nhẹ thành schwa (/tə/). Khi đọc nhấn mạnh, chu tròn môi thành /tuː/.",
    phonemes: [
      { ipa: "t", type: "Phụ âm bật hơi vô thanh", tip: "Chặn hơi sau nướu răng trên rồi bật mạnh luồng khí ra." },
      { ipa: "uː", type: "Nguyên âm dài chu môi sâu", tip: "Chu tròn môi nhỏ phía trước, nâng cuống lưỡi sâu trong họng." },
    ],
  },
  but: {
    word: "but",
    ipa: "bʌt",
    syllables: "but",
    googleRespelling: "buht",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mím Môi Bật Nướu (/bʌt/)",
    lipGuide: "Hai môi mím chặt rồi bật nhẹ /b/, sau đó mở hàm vừa phải tự nhiên cho âm ngắn /ʌ/.",
    tongueGuide: "Lưỡi hạ ở vị trí trung tâm cho /ʌ/, sau đó đầu lưỡi nâng lên chạm nướu trên chặn luồng hơi ở /t/.",
    airflowGuide: "Rung dây thanh ở /bʌ/, ngắt hơi dứt khoát bằng đầu lưỡi chạm nướu ở phụ âm đuôi /t/.",
    vietnameseTip: "Âm /ʌ/ là âm ngắn dứt khoát. Giữ đầu lưỡi chạm nướu để chặn âm /t/ đuôi, không thả trôi âm.",
    phonemes: [
      { ipa: "b", type: "Phụ âm tắc hai môi", tip: "Mím hai môi rồi bật nhẹ với độ rung thanh quản." },
      { ipa: "ʌ", type: "Nguyên âm ngắn mở vừa", tip: "Thả lỏng hàm dưới nhẹ, phát âm gọn từ cổ họng." },
      { ipa: "t", type: "Phụ âm tắc chân răng", tip: "Đầu lưỡi chạm nướu trên chặn dứt luồng khí." },
    ],
  },
  i: {
    word: "i",
    ipa: "aɪ",
    syllables: "I",
    googleRespelling: "eye",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mở Rộng Trượt Căng Mép (/aɪ/)",
    lipGuide: "Hạ hàm mở rộng miệng theo chiều dọc ở /a/, sau đó nâng hàm và kéo căng khóe môi sang hai bên ở /ɪ/.",
    tongueGuide: "Thân lưỡi nằm thấp ở đáy miệng lúc đầu, sau đó trượt nhanh lên cao hướng về vòm cứng.",
    airflowGuide: "Hữu thanh ngân vang, luồng hơi dồi dào qua khoang miệng mở.",
    vietnameseTip: "Phát âm rõ ràng đầy đủ hai pha: mở rộng hàm trước rồi mới khép hẹp khóe môi, tạo độ vang tự nhiên.",
    phonemes: [
      { ipa: "aɪ", type: "Nguyên âm đôi rộng -> hẹp", tip: "Mở rộng miệng rồi lướt mượt mà về phía âm /ɪ/." },
    ],
  },
  a: {
    word: "a",
    ipa: "ə",
    syllables: "a",
    googleRespelling: "uh",
    mouthShape: "NEUTRAL",
    mouthTitle: "Khẩu hình Thả Lỏng Trung Tính Schwa (/ə/)",
    lipGuide: "Môi hé mở tự nhiên, hoàn toàn không căng cơ môi hay khóe miệng.",
    tongueGuide: "Lưỡi nằm thư giãn ở giữa khoang miệng, không nâng cao cũng không hạ thấp.",
    airflowGuide: "Hữu thanh nhẹ nhàng, thời lượng phát âm cực ngắn.",
    vietnameseTip: "Đọc thật lướt và nhẹ, không nhấn giọng hay kéo dài.",
    phonemes: [
      { ipa: "ə", type: "Nguyên âm trung tính schwa", tip: "Thả lỏng toàn bộ cơ miệng, phát âm nhanh như tiếng thở nhẹ." },
    ],
  },
  continuous: {
    word: "continuous",
    ipa: "kənˈtɪnjuəs",
    syllables: "con · tin · u · ous",
    googleRespelling: "kuhn-TIN-yoo-uhs",
    mouthShape: "ROUNDED",
    mouthTitle: "Khẩu hình Bật Nướu & Chu Môi U (/kənˈtɪnjuəs/)",
    lipGuide: "Thả lỏng ở âm đầu, chu môi tròn khi sang vần /-tɪnju-/, kết thúc bằng hai hàm răng khép hờ xát nhẹ /s/.",
    tongueGuide: "Cuống lưỡi bật /k/, đầu lưỡi chạm nướu bật /t/, mặt lưỡi nâng trượt âm /ju/, đầu lưỡi sau răng cửa bật /s/.",
    airflowGuide: "Nhịp điệu dồn dập, nhấn mạnh trọng âm vào âm tiết thứ 2 '-TIN-', hơi xát mịn ở đuôi /s/.",
    vietnameseTip: "Chú ý âm nối /ju/ ở giữa: phát âm như 'ti-niu-ợs'. Đừng quên âm đuôi /s/ xát mịn.",
    phonemes: [
      { ipa: "kən", type: "Âm tiết lướt nhẹ", tip: "Phát âm schwa cực nhanh." },
      { ipa: "tɪn", type: "Âm tiết trọng âm", tip: "Bật /t/ mạnh, giữ nguyên âm /ɪ/ ngắn và nén khí ở /n/." },
      { ipa: "ju", type: "Cụm lướt chu môi", tip: "Mặt lưỡi trượt sát vòm cứng, môi chu tròn." },
      { ipa: "əs", type: "Âm đuôi xát", tip: "Thả lỏng cơ rồi thổi hơi ma sát sắc qua kẽ răng." },
    ],
  },
  practice: {
    word: "practice",
    ipa: "ˈpræktɪs",
    syllables: "prac · tice",
    googleRespelling: "PRAK-tis",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mở Rộng Bẹt /æ/ & Bật /pr-kt-s/",
    lipGuide: "Mím môi bật /p/, kéo môi dẹt sang hai bên và hạ thấp hàm dưới cho nguyên âm bẹt /æ/, răng khép hờ xát /s/.",
    tongueGuide: "Đầu lưỡi cong nhẹ cho /r/, ép phẳng sàn miệng cho /æ/, cuống lưỡi chặn ngạc mềm cho /k/, lưỡi đưa về nướu xát /s/.",
    airflowGuide: "Bật hơi mạnh ở /p/, rung thanh quản ở /ræ/, ngắt hơi bằng /k/ và xát hơi dài ở /s/.",
    vietnameseTip: "Trọng âm rơi vào 'PRAC-'. Hạ hàm rộng cho âm /æ/ bẹt, chặn /k/ rồi nhả /s/ dứt khoát.",
    phonemes: [
      { ipa: "pr", type: "Cụm phụ âm bật - cong lưỡi", tip: "Bật /p/ rồi lập tức cong lưỡi đón âm /r/." },
      { ipa: "æ", type: "Nguyên âm bẹt mở rộng", tip: "Hạ hàm sâu, khóe miệng căng sang 2 bên." },
      { ipa: "kt", type: "Cụm phụ âm ngắt", tip: "Chặn hơi ở cuống họng /k/ rồi chuyển sang nướu /t/." },
      { ipa: "ɪs", type: "Đuôi âm tiết lướt", tip: "Phát âm nhẹ, thổi hơi rít /s/ rõ ràng." },
    ],
  },
  empowers: {
    word: "empowers",
    ipa: "ɪmˈpaʊərz",
    syllables: "em · pow · ers",
    googleRespelling: "em-POW-erz",
    mouthShape: "OPEN_WIDE",
    mouthTitle: "Khẩu hình Mở Rộng Hàm /aʊ/ & Cong Lưỡi /rz/",
    lipGuide: "Môi khép nhẹ ở /ɪm/, mở to hàm dưới cho /a/, sau đó chu tròn môi ở /ʊ/ và thả lỏng rung răng ở /z/.",
    tongueGuide: "Lưỡi trượt từ đáy miệng lên vòm họng mềm, sau đó cong nhẹ đầu lưỡi đón âm /r/ và áp sát nướu rung /z/.",
    airflowGuide: "Dây thanh rung mạnh ở âm tiết trọng âm '-POW-', luồng hơi thoát ra có độ rền của âm R và rung của /z/.",
    vietnameseTip: "Trọng âm ở '-POW-'. Há to miệng rồi thu tròn môi như tiếng 'ao' nhưng sâu hơn, âm đuôi rung /z/ (không đọc là /s/).",
    phonemes: [
      { ipa: "ɪm", type: "Tiền tố lướt", tip: "Khép nhẹ hai môi, phát âm nhanh." },
      { ipa: "paʊ", type: "Trọng âm chính", tip: "Bật mạnh /p/, mở rộng hàm rồi chu môi cho /aʊ/." },
      { ipa: "ərz", type: "Đuôi hữu thanh", tip: "Cong nhẹ đầu lưỡi cho /r/, thổi hơi rung thanh quản cho /z/." },
    ],
  },
  learners: {
    word: "learners",
    ipa: "ˈlɜːrnərz",
    syllables: "learn · ers",
    googleRespelling: "LUR-nerz",
    mouthShape: "RETROFLEX_R",
    mouthTitle: "Khẩu hình Đầu Lưỡi Chạm Nướu & Cong Vòm /ɜːr/",
    lipGuide: "Môi hơi chúm nhẹ tự nhiên, không chu quá mức cũng không căng dẹt.",
    tongueGuide: "Đầu lưỡi chạm nướu trên cho /l/, sau đó rút về phía sau và cong nhẹ lên vòm miệng cho âm /ɜːr/, chạm nướu cho /n/, rung /z/.",
    airflowGuide: "Hữu thanh liên tục, luồng hơi dồi dào qua hai bên cạnh lưỡi ở /l/ và rền ở /ɜːr/.",
    vietnameseTip: "Âm /ɜːr/ cần có độ cong lưỡi sâu để tạo ngữ điệu bản xứ. Đuôi '-ers' phát âm hữu thanh rung /z/.",
    phonemes: [
      { ipa: "l", type: "Phụ âm cạnh lưỡi", tip: "Đầu lưỡi chạm nướu trên." },
      { ipa: "ɜːr", type: "Nguyên âm cong lưỡi rền", tip: "Rút thân lưỡi về sau, cong nhẹ đầu lưỡi hướng lên vòm miệng." },
      { ipa: "nərz", type: "Âm tiết đuôi", tip: "Chạm nướu bật /n/, lướt schwa và rung dây thanh /z/." },
    ],
  },
  speak: {
    word: "speak",
    ipa: "spiːk",
    syllables: "speak",
    googleRespelling: "speek",
    mouthShape: "SPREAD",
    mouthTitle: "Khẩu hình Căng Khóe Môi Sang Hai Bên (/spiːk/)",
    lipGuide: "Khép hờ hai hàm răng xát hơi /s/, mím môi bật /p/, rồi kéo căng mạnh khóe miệng sang hai bên cho nguyên âm dài /iː/.",
    tongueGuide: "Mặt lưỡi nâng cao sát vòm miệng cứng, đầu lưỡi nằm ngay sau răng cửa dưới cho /iː/, cuống lưỡi bật /k/.",
    airflowGuide: "Hơi xát mịn ở /s/, nén nhả ở /p/, rung thanh quản ngân vang ở /iː/, ngắt sắc bén ở /k/.",
    vietnameseTip: "Kéo căng mép sang hai bên như đang cười tươi khi phát âm /iː/, giữ âm ngân dài trước khi bật âm /k/ kết thúc.",
    phonemes: [
      { ipa: "sp", type: "Cụm phụ âm xát - bật", tip: "Xát /s/ rồi chuyển mượt sang mím bật /p/." },
      { ipa: "iː", type: "Nguyên âm dài căng mép", tip: "Kéo khóe môi sang 2 bên, nâng cao thân lưỡi." },
      { ipa: "k", type: "Phụ âm bật hơi vô thanh", tip: "Bật dứt khoát ở cuống họng để khóa âm." },
    ],
  },
  with: {
    word: "with",
    ipa: "wɪð",
    syllables: "with",
    googleRespelling: "with",
    mouthShape: "INTERDENTAL",
    mouthTitle: "Khẩu hình Lưỡi Kẹp Giữa Hai Hàm Răng (/wɪð/)",
    lipGuide: "Chu tròn môi nhỏ ở đầu từ (/w/), sau đó thả lỏng môi và hé mở răng để đưa đầu lưỡi ra giữa hai hàm răng (/ð/).",
    tongueGuide: "Đầu lưỡi thò nhẹ ra ngoài đặt giữa hai hàm răng cửa trên và dưới, không cắn chặt, để luồng hơi ma sát thoát qua.",
    airflowGuide: "Dây thanh quản rung đều; luồng hơi ma sát êm ái qua khe giữa mặt lưỡi và răng cửa trên.",
    vietnameseTip: "Cực kỳ chú ý âm cuối /ð/. Hãy đưa nhẹ đầu lưỡi ra ngoài kẹp giữa hai hàng răng và rung nhẹ dây thanh, không đọc thành 'uýt' hay 'guýt'.",
    phonemes: [
      { ipa: "w", type: "Bán nguyên âm chu môi", tip: "Chu tròn môi phía trước đón âm." },
      { ipa: "ɪ", type: "Nguyên âm ngắn thả lỏng", tip: "Miệng hé nhỏ, phát âm nhanh gọn." },
      { ipa: "ð", type: "Phụ âm xát kẹp răng hữu thanh", tip: "Đặt đầu lưỡi giữa hai hàm răng cửa, thổi luồng hơi rung dây thanh." },
    ],
  },
  unwavering: {
    word: "unwavering",
    ipa: "ʌnˈweɪvərɪŋ",
    syllables: "un · wa · ver · ing",
    googleRespelling: "uhn-WAY-ver-ing",
    mouthShape: "LABIODENTAL",
    mouthTitle: "Khẩu hình Chuyển Đổi Môi Chu -> Răng Cắn Môi (/ʌnˈweɪvərɪŋ/)",
    lipGuide: "Mở miệng vừa cho /ʌn/, chu tròn môi cho /weɪ/, sau đó răng trên chạm mép trong môi dưới phát âm /v/ và rung /ŋ/.",
    tongueGuide: "Đầu lưỡi chạm nướu cho /n/, cuống lưỡi nâng cho /w/, răng chạm môi cho /v/, nâng gốc lưỡi chạm ngạc mềm cho /ŋ/.",
    airflowGuide: "Luồng hơi chuyển đổi phong phú giữa luồng khí mũi (/n/, /ŋ/), luồng hơi tròn môi (/w/) và luồng hơi ma sát răng-môi (/v/).",
    vietnameseTip: "Nhấn mạnh trọng âm vào âm tiết '-WA-'. Phân biệt rõ âm chu môi /w/ và âm răng chạm môi /v/ đứng ngay cạnh nhau.",
    phonemes: [
      { ipa: "ʌn", type: "Tiền tố phủ định", tip: "Phát âm dứt khoát, đầu lưỡi chạm nướu trên." },
      { ipa: "weɪ", type: "Trọng âm chính chu môi", tip: "Chu môi tròn rồi trượt dẹt sang hai bên." },
      { ipa: "vər", type: "Âm tiết giữa răng-môi", tip: "Răng trên chạm môi dưới, rung thanh quản kèm cong lưỡi nhẹ." },
      { ipa: "ɪŋ", type: "Đuôi âm mũi ngạc mềm", tip: "Nâng cuống lưỡi lên ngạc mềm, hơi dội qua mũi." },
    ],
  },
  confidence: {
    word: "confidence",
    ipa: "ˈkɒnfɪdəns",
    syllables: "con · fi · dence",
    googleRespelling: "KON-fi-duhns",
    mouthShape: "LABIODENTAL",
    mouthTitle: "Khẩu hình Mở Rộng -> Răng Chạm Môi -> Xát Răng (/ˈkɒnfɪdəns/)",
    lipGuide: "Mở hàm vừa bo tròn nhẹ cho /kɒ/, răng trên chạm môi dưới cho /f/, thả lỏng ở /də/, khép hờ hai hàm răng xát mịn /ns/.",
    tongueGuide: "Bật cuống lưỡi cho /k/, lưỡi hạ cho /ɒ/, đầu lưỡi chạm nướu cho /d/, đưa đầu lưỡi sát chân răng cửa xát hơi /s/.",
    airflowGuide: "Trọng âm nổ mạnh ở 'CON-', hơi ma sát mịn ở /f/ và kết thúc bằng tiếng xát /s/ rõ ràng.",
    vietnameseTip: "Trọng âm rơi mạnh vào âm tiết đầu 'CON-'. Đừng nuốt âm /f/ ở giữa và âm xát /s/ ở đuôi từ.",
    phonemes: [
      { ipa: "kɒn", type: "Âm tiết trọng âm", tip: "Bật mạnh /k/, hạ hàm vừa, đầu lưỡi chặn nướu /n/." },
      { ipa: "fɪ", type: "Âm tiết răng-môi", tip: "Răng cửa trên chạm môi dưới, thổi hơi không rung thanh quản." },
      { ipa: "dəns", type: "Đuôi âm tiết ngắt", tip: "Bật nhẹ /d/, lướt schwa và thổi hơi xát /s/ qua kẽ răng." },
    ],
  },
  listen: {
    word: "listen",
    ipa: "ˈlɪsən",
    syllables: "lis · ten",
    googleRespelling: "LIS-uhn",
    mouthShape: "ALVEOLAR_TAP",
    mouthTitle: "Khẩu hình Đầu Lưỡi Chạm Nướu & Xát Răng (/ˈlɪsən/)",
    lipGuide: "Môi thả lỏng tự nhiên, hé mở vừa phải, hai hàm răng khép gần nhau ở âm xát /s/.",
    tongueGuide: "Đầu lưỡi chạm nướu răng trên phát âm /l/, sau đó hạ xuống sau răng cửa xát luồng hơi /s/, chạm lại nướu cho /n/.",
    airflowGuide: "Âm /t/ câm hoàn toàn. Luồng hơi xát mượt mà qua khe răng ở /s/ và kết thúc bằng âm mũi /n/.",
    vietnameseTip: "Chữ 't' trong 'listen' là âm câm! Đọc là 'LI-sừn', không đọc là 'lít-xừn'.",
    phonemes: [
      { ipa: "l", type: "Phụ âm cạnh lưỡi", tip: "Đầu lưỡi chạm nướu trên." },
      { ipa: "ɪ", type: "Nguyên âm ngắn", tip: "Hé miệng thả lỏng." },
      { ipa: "s", type: "Phụ âm xát vô thanh", tip: "Thổi hơi rít qua kẽ hai hàm răng." },
      { ipa: "ən", type: "Đuôi âm mũi lướt", tip: "Đầu lưỡi chạm lại nướu trên, dội hơi qua mũi." },
    ],
  },
};

/**
 * Heuristic phân tích âm vị và khẩu hình phong cách Google cho từ tiếng Anh bất kỳ
 */
export function getWordPhonetics(rawWord: string): WordPhoneticsData {
  const clean = rawWord.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase();

  // 1. Kiểm tra từ điển có sẵn
  if (WORD_PHONETICS_STORE[clean]) {
    return WORD_PHONETICS_STORE[clean];
  }

  // 2. Suy luận khẩu hình dựa trên quy luật ngữ âm
  let mouthShape: MouthShapeType = "NEUTRAL";
  let mouthTitle = `Khẩu hình Chuẩn Xác của từ “${rawWord}”`;
  let lipGuide = "Mở khẩu hình tự nhiên, thả lỏng cơ môi và giữ luồng hơi đều.";
  let tongueGuide = "Giữ thân lưỡi ở tư thế trung tâm, đầu lưỡi linh hoạt theo từng phụ âm.";
  let airflowGuide = "Luồng hơi thoát đều từ lồng ngực qua thanh quản, duy trì độ vang tự nhiên.";
  let vietnameseTip = `Lắng nghe kỹ phát âm mẫu bản xứ của từ “${rawWord}”, chú ý nhấn đúng trọng âm và bật rõ âm đuôi.`;
  let ipa = clean;

  if (clean.includes("th")) {
    mouthShape = "INTERDENTAL";
    mouthTitle = `Khẩu hình Lưỡi Kẹp Giữa Hai Hàm Răng (/θ/ - /ð/)`;
    lipGuide = "Hé mở nhẹ hai môi để lộ hai hàm răng cửa.";
    tongueGuide = "Đặt nhẹ đầu lưỡi thò ra giữa hai hàm răng cửa, không cắn chặt, tạo khe hở nhỏ cho luồng hơi.";
    airflowGuide = "Thổi luồng hơi ma sát êm ái qua khe giữa mặt lưỡi và răng cửa trên.";
    vietnameseTip = "Tập trung đưa đầu lưỡi ra giữa hai hàm răng khi gặp cụm 'th', không thay thế bằng âm /t/ hay /d/ tiếng Việt.";
    ipa = clean.replace(/th/g, "θ");
  } else if (clean.startsWith("w") || clean.startsWith("wh") || clean.includes("oo") || clean.includes("ou")) {
    mouthShape = "ROUNDED";
    mouthTitle = `Khẩu hình Môi Chu Tròn Phía Trước (/w/ - /uː/)`;
    lipGuide = "Thu tròn hai môi lại như chuẩn bị huýt sáo hoặc thổi nến.";
    tongueGuide = "Cuống lưỡi nâng cao về phía ngạc mềm trong cổ họng, đầu lưỡi hạ thấp.";
    airflowGuide = "Luồng hơi thoát ra qua lỗ tròn nhỏ giữa hai môi với độ rung thanh quản.";
    vietnameseTip = "Chu tròn môi thật gọn gàng về phía trước, không bẹt môi sang hai bên.";
    ipa = clean.replace(/wh?/g, "w").replace(/oo/g, "uː");
  } else if (clean.includes("sh") || clean.includes("ch") || clean.includes("ge") || clean.includes("j")) {
    mouthShape = "PALATAL_SIBILANT";
    mouthTitle = `Khẩu hình Môi Chúm Nhẹ & Xát Vòm Miệng (/ʃ/ - /tʃ/)`;
    lipGuide = "Môi chúm nhẹ và hơi loe ra phía trước như đang ra hiệu giữ im lặng.";
    tongueGuide = "Nâng toàn bộ mặt lưỡi lên sát vòm miệng cứng, tạo khe hẹp để luồng hơi ma sát.";
    airflowGuide = "Thổi luồng hơi mạnh và dày qua khe giữa mặt lưỡi và vòm miệng.";
    vietnameseTip = "Chúm môi tròn nhẹ và đẩy luồng hơi dày, không để xẹp môi phẳng như âm /s/.";
    ipa = clean.replace(/sh/g, "ʃ").replace(/ch/g, "tʃ");
  } else if (clean.includes("f") || clean.includes("ph") || clean.includes("v")) {
    mouthShape = "LABIODENTAL";
    mouthTitle = `Khẩu hình Răng Trên Chạm Môi Dưới (/f/ - /v/)`;
    lipGuide = "Môi trên vén nhẹ, răng cửa hàm trên đặt nhẹ lên phần mép trong của môi dưới.";
    tongueGuide = "Lưỡi ở vị trí tự do, không tham gia cản trở luồng hơi.";
    airflowGuide = "Đẩy luồng hơi ma sát qua khe giữa răng cửa trên và môi dưới.";
    vietnameseTip = "Đảm bảo răng trên tiếp xúc nhẹ với môi dưới trước khi phát âm, không mím chặt hai môi.";
    ipa = clean.replace(/ph/g, "f");
  } else if (clean.includes("ee") || clean.includes("ea") || clean.includes("ey") || clean.endsWith("y")) {
    mouthShape = "SPREAD";
    mouthTitle = `Khẩu hình Căng Khóe Môi Sang Hai Bên (/iː/)`;
    lipGuide = "Kéo căng khóe môi sang hai bên giống như đang cười mỉm.";
    tongueGuide = "Nâng phần trước của lưỡi lên cao sát vòm ngạc cứng, đầu lưỡi chạm sau răng cửa dưới.";
    airflowGuide = "Dây thanh quản rung mạnh, luồng hơi dồi dào qua khe hẹp miệng.";
    vietnameseTip = "Căng mép sang hai bên và kéo dài âm một chút để tạo độ vang sáng cho nguyên âm dài /iː/.";
    ipa = clean.replace(/ee|ea|ey/g, "iː");
  } else if (clean.includes("a") && (clean.length <= 4 || clean.includes("ck") || clean.includes("ct"))) {
    mouthShape = "OPEN_WIDE";
    mouthTitle = `Khẩu hình Mở Rộng Hàm Chữ A Bẹt (/æ/)`;
    lipGuide = "Mở rộng miệng theo cả chiều dọc (hạ hàm dưới) lẫn chiều ngang (căng mép).";
    tongueGuide = "Thân lưỡi ép phẳng xuống sàn miệng, đầu lưỡi tựa vào chân răng cửa dưới.";
    airflowGuide = "Luồng hơi thoát rộng từ đáy họng, tạo độ vang to và sâu.";
    vietnameseTip = "Hạ hàm dưới sâu hơn bình thường để phát âm chuẩn âm A bẹt, không khép hàm quá hẹp.";
    ipa = clean.replace(/a/g, "æ");
  } else if (clean.includes("r")) {
    mouthShape = "RETROFLEX_R";
    mouthTitle = `Khẩu hình Cong Đầu Lưỡi Lên Vòm Họng (/r/ - /ɜːr/)`;
    lipGuide = "Môi hơi chúm nhẹ tự nhiên, hai bên má hơi hóp vào.";
    tongueGuide = "Uốn cong nhẹ đầu lưỡi hướng lên vòm ngạc trên nhưng tuyệt đối không chạm vào nướu răng.";
    airflowGuide = "Luồng hơi dội qua khoảng trống phía dưới đầu lưỡi cong tạo độ rền bản xứ.";
    vietnameseTip = "Giữ đầu lưỡi lơ lửng không chạm bất kỳ điểm nào trên vòm miệng khi phát âm R.";
  }

  // Tách các âm vị ước tính
  const phonemes: PhonemeBreakdownItem[] = [
    { ipa: ipa.slice(0, Math.ceil(ipa.length / 2)) || clean, type: "Âm đầu / Thân từ", tip: "Mở khẩu hình chuẩn xác theo hướng dẫn ở trên." },
    { ipa: ipa.slice(Math.ceil(ipa.length / 2)) || "d", type: "Âm đuôi (Ending sound)", tip: "Bật rõ âm đuôi để tránh nuốt từ khi phát âm." },
  ];

  return {
    word: clean,
    ipa,
    syllables: clean,
    googleRespelling: ipa,
    mouthShape,
    mouthTitle,
    lipGuide,
    tongueGuide,
    airflowGuide,
    vietnameseTip,
    phonemes,
  };
}
