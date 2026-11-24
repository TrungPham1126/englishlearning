package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.AudioGeneratedBy;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.entity.SkillType;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public interface ExerciseAudioService {

    String DEFAULT_SHADOWING_VOICE = "af_heart";

    List<String> DIALOGUE_VOICE_ROTATION = List.of(
            "af_heart",   // Speaker 1: US Nữ (Truyền cảm, tự nhiên)
            "am_michael", // Speaker 2: US Nam (Trầm ấm, rõ ràng)
            "bf_emma",    // Speaker 3: UK Nữ (Chuẩn Received Pronunciation)
            "bm_george"   // Speaker 4: UK Nam (Chuẩn BBC)
    );

    Pattern DIALOGUE_LINE_PATTERN = Pattern.compile(
            "^(?:[-*•]+|\\d+[.)])?\\s*(?:\\*{1,2}|_)?(?:\\[\\s*([A-Za-z0-9_.\\-\\s]{1,30})\\s*\\]|([A-Za-z0-9_.\\-\\s]{1,30})(?:\\s*\\([^)]{1,25}\\))?)(?:\\*{1,2}|_)?\\s*:\\s*(?:\\*{1,2}|_)?\\s*(.+)$"
    );

    Pattern INLINE_SPEAKER_SPLIT_PATTERN = Pattern.compile(
            "(?<=\\.|\\?|!)\\s+(?=(?:\\*{1,2}|_)?(?:Friend\\s+[A-Z0-9]|Speaker\\s+[A-Z0-9]|Person\\s+[A-Z0-9]|Student\\s+[A-Z0-9]|Man|Woman|Boy|Girl|Receptionist|Customer|Interviewer|Candidate|Teacher|Professor|Waiter|Waitress|Doctor|Patient|[A-Z][a-z]{2,15})(?:\\*{1,2}|_)?\\s*:)"
    );

    Set<String> FEMALE_KEYWORDS = Set.of(
            "woman", "girl", "female", "lady", "mother", "mom", "mum", "sister", "daughter", "wife",
            "mrs", "ms", "miss", "madam", "waitress", "actress", "hostess", "nurse", "receptionist",
            "alice", "sarah", "emma", "anna", "mary", "lisa", "jane", "emily", "sophia", "olivia",
            "bella", "heart", "claire", "lucy", "hannah", "rachel", "kate", "katie", "jessica", "amy", "linda", "susan", "maria", "elena"
    );

    Set<String> MALE_KEYWORDS = Set.of(
            "man", "boy", "male", "gentleman", "father", "dad", "brother", "son", "husband",
            "mr", "sir", "waiter", "actor", "host", "policeman", "manager",
            "bob", "john", "michael", "david", "tom", "james", "robert", "william", "richard",
            "charles", "thomas", "daniel", "matthew", "mark", "paul", "steven", "kevin", "brian",
            "george", "adam", "alex", "ben", "jack", "sam", "peter", "chris", "eric", "nick", "ryan"
    );

    List<String> FEMALE_VOICE_POOL = List.of("af_heart", "bf_emma", "af_bella");
    List<String> MALE_VOICE_POOL = List.of("am_michael", "bm_george", "am_adam");

    String synthesizeRawScriptToUrl(String rawScript, String preferredVoice, double speed);

    ExerciseAudioResponseDto generateOrGetAudioForQuestion(
            UUID questionId,
            AudioGeneratedBy generatedBy,
            boolean forceRecreate,
            String preferredVoice);

    ExerciseAudioResponseDto generateOrGetAudioForQuestion(
            UUID questionId,
            AudioGeneratedBy generatedBy,
            boolean forceRecreate,
            String preferredVoice,
            String customTextOverride);

    void generateAudiosForAssignmentAsync(UUID assignmentId, AudioGeneratedBy generatedBy);

    ExerciseAudioResponseDto repairAudio(UUID questionId, UUID requestingUserId, boolean isStudent);

    ExerciseAudioResponseDto repairAudio(
            UUID questionId,
            UUID requestingUserId,
            boolean isStudent,
            String customText,
            String customVoice);

    ExerciseAudioResponseDto getAudioStatus(UUID questionId);

    List<KokoroVoiceDto> getKokoroVoices();

    // =========================================================================
    // STATIC UTILITIES & INNER CLASSES
    // =========================================================================

    static String normalizeKokoroVoice(String voice) {
        if (voice == null || voice.isBlank()) {
            return DEFAULT_SHADOWING_VOICE;
        }
        String v = voice.trim();
        return switch (v) {
            case "af_heart", "am_michael", "af_bella", "am_adam", "bf_emma", "bm_george" -> v;
            case "en-US-JennyNeural" -> "af_heart";
            case "en-US-GuyNeural" -> "am_michael";
            case "en-GB-SoniaNeural" -> "bf_emma";
            case "en-GB-RyanNeural" -> "bm_george";
            default -> DEFAULT_SHADOWING_VOICE;
        };
    }

    static String extractCleanShadowingSentence(AssignmentQuestion question) {
        if (question == null) return "";

        String trans = question.getTranscript();
        if (trans != null && !trans.isBlank()
                && !trans.toLowerCase().contains("audio speech submission")
                && !trans.toLowerCase().contains("sample high-band")
                && !trans.toLowerCase().contains("answer should")
                && !trans.toLowerCase().contains("tùy chọn")
                && !trans.toLowerCase().contains("presentation response")) {
            String cleanedTrans = cleanShadowingSentence(trans);
            if (!cleanedTrans.isBlank()) {
                return cleanedTrans;
            }
        }

        String ans = question.getCorrectAnswer();
        if (ans != null && !ans.isBlank()
                && !ans.toLowerCase().contains("audio speech submission")
                && !ans.toLowerCase().contains("sample high-band")
                && !ans.toLowerCase().contains("answer should")
                && !ans.toLowerCase().contains("tùy chọn")
                && !ans.toLowerCase().contains("presentation response")) {
            String cleanedAns = cleanShadowingSentence(ans);
            if (!cleanedAns.isBlank()) {
                return cleanedAns;
            }
        }

        String prompt = question.getPromptText();
        if (prompt != null && !prompt.isBlank()) {
            return cleanShadowingSentence(prompt);
        }

        return "";
    }

    static String cleanShadowingSentence(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String s = raw.trim();

        Pattern quotePattern = Pattern.compile("[\"'“‘]([^\"'”’]{4,})[\"'”’]");
        Matcher matcher = quotePattern.matcher(s);
        if (matcher.find()) {
            String prefixBeforeQuote = s.substring(0, matcher.start()).trim();
            String suffixAfterQuote = s.substring(matcher.end()).trim();
            String inside = matcher.group(1).trim();
            boolean wholeWrapped = prefixBeforeQuote.isEmpty()
                    && suffixAfterQuote.replaceAll("[\\s.!?]+", "").isEmpty();
            boolean precededByInstruction = prefixBeforeQuote.endsWith(":")
                    || prefixBeforeQuote.matches("(?i)^(?:please\\s+)?(?:listen|repeat|shadow|read|imitate|practice|hãy\\s+nghe|nhại|đọc|câu).*");
            if ((wholeWrapped || precededByInstruction)
                    && (inside.split("\\s+").length >= 2 || inside.length() >= 8)) {
                s = inside;
            }
        } else if (s.contains(":")) {
            int colonIdx = s.lastIndexOf(':');
            String beforeColon = s.substring(0, colonIdx).trim();
            String lastPart = s.substring(colonIdx + 1).trim();
            if ((beforeColon.length() <= 45 || beforeColon.matches("(?i).*(?:shadow|repeat|listen|read|imitate|practice|say|sentence|question|câu|hãy|nghe|nhại|lặp|đọc).*"))
                    && !lastPart.isBlank()
                    && (lastPart.split("\\s+").length >= 2 || lastPart.length() >= 8)) {
                s = lastPart;
            }
        }

        s = s.replaceAll("(?i)^(?:please\\s+)?(?:listen\\s+(?:and|&|\\+)\\s+(?:repeat|shadow)|repeat\\s+after\\s+(?:me|the\\s+speaker)|shadow(?:ing)?(?:\\s+practice(?:\\s*\\d+)?)?(?:\\s+the\\s+following)?(?:\\s+sentence)?|read\\s+aloud|imitate\\s+the\\s+sentence|practice\\s+saying)[:\\s\\-–—]+", "");
        s = s.replaceAll("(?i)^(?:hãy\\s+)?(?:nghe\\s+(?:và|&)\\s+(?:nhại|lặp)\\s+lại|nhại\\s+(?:theo|giọng|lại)|đọc\\s+(?:theo|lại)|luyện\\s+phát\\s+âm)(?:\\s+chính\\s+xác(?:\\s+ngữ\\s+điệu)?)?(?:\\s+câu(?:\\s+sau)?)?[:\\s\\-–—]+", "");
        s = s.replaceAll("(?i)^(?:question|câu)\\s*\\d+[:\\s.\\-–—]+", "");
        s = s.replaceAll("^\\d+[\\.\\)\\-–—]\\s*", "");

        s = s.replaceAll("^[\"'“‘«\\s]+|[\"'”’»\\s]+$", "").trim();

        if (s.contains("\n")) {
            String[] lines = s.split("\\r?\\n");
            for (int i = lines.length - 1; i >= 0; i--) {
                String line = lines[i].trim();
                if (!line.isBlank() && !line.toLowerCase().matches(".*(hãy|lặp lại|nghe|shadow|repeat).*")) {
                    s = line.replaceAll("^[\"'“‘«\\s]+|[\"'”’»\\s]+$", "").trim();
                    break;
                }
            }
        }

        return s;
    }

    static String stripSpeakerAndStageDirections(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String normalized = INLINE_SPEAKER_SPLIT_PATTERN.matcher(raw.trim()).replaceAll("\n");
        String[] lines = normalized.split("\\r?\\n");
        List<String> cleanedLines = new ArrayList<>();
        for (String rawLine : lines) {
            String s = rawLine.trim();
            if (s.isBlank()) continue;
            s = s.replaceAll("^(?:[-*•]+|\\d+[.)])\\s*", "");
            s = s.replaceAll("^(?:\\*{1,2}|_)?(?:\\[\\s*([A-Za-z0-9_.\\-\\s]{1,30})\\s*\\]|([A-Za-z0-9_.\\-\\s]{1,30})(?:\\s*\\([^)]{1,25}\\))?)(?:\\*{1,2}|_)?\\s*:\\s*(?:\\*{1,2}|_)?\\s*", "");
            s = s.replaceAll("(?i)\\(\\s*(?:laugh(?:s|ing)?|sigh(?:s|ing)?|cough(?:s|ing)?|pause(?:s)?|whisper(?:s|ing)?|chuckle(?:s|ing)?|smile(?:s|ing)?|gasp(?:s)?|clears throat|music|applause|excited|angry|sad|happy|surprised|nervous)\\s*\\)", " ");
            s = s.replaceAll("\\[\\s*[^\\]]{1,30}\\s*\\]", " ");
            s = s.replaceAll("[*_#`~]+", "");
            s = s.replaceAll("\\s+", " ").trim();
            if (!s.isBlank()) {
                cleanedLines.add(s);
            }
        }
        return String.join(" ", cleanedLines).trim();
    }

    static String resolveSmartVoiceForSpeaker(String speakerLabel, Collection<String> alreadyAssignedVoices) {
        String clean = (speakerLabel == null ? "" : speakerLabel)
                .replaceAll("[^a-zA-Z0-9\\s]", " ")
                .trim()
                .toLowerCase();
        Set<String> tokens = new HashSet<>(Arrays.asList(clean.split("\\s+")));

        boolean isFemale = !Collections.disjoint(tokens, FEMALE_KEYWORDS);
        boolean isMale = !Collections.disjoint(tokens, MALE_KEYWORDS);

        if (!isFemale && !isMale) {
            if (clean.contains("friend a") || clean.contains("speaker a") || clean.contains("person a")
                    || clean.contains("student a") || clean.contains("speaker 1") || clean.contains("person 1")
                    || clean.contains("student 1") || "a".equals(clean)) {
                isFemale = true;
            } else if (clean.contains("friend b") || clean.contains("speaker b") || clean.contains("person b")
                    || clean.contains("student b") || clean.contains("speaker 2") || clean.contains("person 2")
                    || clean.contains("student 2") || "b".equals(clean)) {
                isMale = true;
            }
        }

        if (isFemale && !isMale) {
            for (String v : FEMALE_VOICE_POOL) {
                if (!alreadyAssignedVoices.contains(v)) {
                    return v;
                }
            }
            return FEMALE_VOICE_POOL.get(alreadyAssignedVoices.size() % FEMALE_VOICE_POOL.size());
        }

        if (isMale && !isFemale) {
            for (String v : MALE_VOICE_POOL) {
                if (!alreadyAssignedVoices.contains(v)) {
                    return v;
                }
            }
            return MALE_VOICE_POOL.get(alreadyAssignedVoices.size() % MALE_VOICE_POOL.size());
        }

        for (String v : DIALOGUE_VOICE_ROTATION) {
            if (!alreadyAssignedVoices.contains(v)) {
                return v;
            }
        }
        return DIALOGUE_VOICE_ROTATION.get(alreadyAssignedVoices.size() % DIALOGUE_VOICE_ROTATION.size());
    }

    static List<DialogueTurnParseResult> parseDialogueScript(String text) {
        if (text == null || text.isBlank()) {
            return Collections.emptyList();
        }
        List<DialogueTurnParseResult> turns = new ArrayList<>();
        String normalizedText = INLINE_SPEAKER_SPLIT_PATTERN.matcher(text.trim()).replaceAll("\n");
        String[] lines = normalizedText.split("\\r?\\n");

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isBlank()) continue;

            String cleanLine = line.replaceAll("^(?:[-*•]+|\\d+[.)])\\s*", "").trim();
            Matcher matcher = DIALOGUE_LINE_PATTERN.matcher(cleanLine);
            if (matcher.find()) {
                String rawSpeaker = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                String speaker = rawSpeaker
                        .replaceAll("\\s*\\([^)]{1,25}\\)", "")
                        .replaceAll("[*_#`~\\[\\]]+", "")
                        .trim();
                String rawUtterance = matcher.group(3);
                String utterance = stripSpeakerAndStageDirections(rawUtterance);
                if (!speaker.isBlank() && !utterance.isBlank()) {
                    turns.add(new DialogueTurnParseResult(speaker, utterance));
                }
            } else if (!turns.isEmpty()) {
                DialogueTurnParseResult lastTurn = turns.get(turns.size() - 1);
                String extra = stripSpeakerAndStageDirections(cleanLine);
                if (!extra.isBlank()) {
                    lastTurn.text = lastTurn.text + " " + extra;
                }
            }
        }

        Map<String, String> speakerVoiceMap = buildSpeakerVoiceMap(turns);
        for (DialogueTurnParseResult t : turns) {
            t.voice = speakerVoiceMap.getOrDefault(t.speaker.toUpperCase(), DEFAULT_SHADOWING_VOICE);
        }
        return turns;
    }

    static Map<String, String> buildSpeakerVoiceMap(List<DialogueTurnParseResult> turns) {
        Map<String, String> speakerVoiceMap = new LinkedHashMap<>();
        List<String> assignedVoices = new ArrayList<>();
        for (DialogueTurnParseResult t : turns) {
            String spkKey = t.speaker.toUpperCase();
            if (!speakerVoiceMap.containsKey(spkKey)) {
                String chosenVoice = resolveSmartVoiceForSpeaker(t.speaker, assignedVoices);
                speakerVoiceMap.put(spkKey, chosenVoice);
                assignedVoices.add(chosenVoice);
            }
        }
        return speakerVoiceMap;
    }

    static boolean containsVietnameseDiacritics(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.matches("(?s).*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ].*");
    }

    static boolean isGradingRubricOrMetaText(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String lower = text.trim().toLowerCase(Locale.ROOT);
        if (containsVietnameseDiacritics(text)) {
            return true;
        }
        return lower.contains("audio speech")
                || lower.contains("sample high-band")
                || lower.contains("answer should")
                || lower.contains("key points")
                || lower.contains("key idea")
                || lower.contains("gợi ý")
                || lower.contains("tiêu chí")
                || lower.contains("tùy chọn")
                || lower.contains("presentation response")
                || lower.contains("(1)")
                || lower.contains("rubric");
    }

    static String resolveSpeakingMode(Assignment assignment, AssignmentQuestion question, String explicitMode) {
        if (explicitMode != null && !explicitMode.isBlank()) {
            String norm = explicitMode.trim().toUpperCase(Locale.ROOT);
            if (norm.contains("SHADOW")) return "SHADOWING";
            if (norm.contains("PART_2") || norm.contains("PART 2") || norm.contains("CUE_CARD")) return "PART_2";
            if (norm.contains("PART_3") || norm.contains("PART 3") || norm.contains("DISCUSSION")) return "PART_3";
            if (norm.contains("QA") || norm.contains("PART_1") || norm.contains("PART 1")) return "QA";
        }

        String aTitle = assignment != null && assignment.getTitle() != null ? assignment.getTitle().toUpperCase(Locale.ROOT) : "";
        String aDesc = assignment != null && assignment.getDescription() != null ? assignment.getDescription().toUpperCase(Locale.ROOT) : "";
        String aMeta = (aTitle + " " + aDesc).trim();

        String qPrompt = question != null && question.getPromptText() != null ? question.getPromptText() : "";
        String qPromptUpper = qPrompt.toUpperCase(Locale.ROOT);

        if (qPromptUpper.startsWith("READ ALOUD")
                || qPromptUpper.startsWith("SHADOWING")
                || qPromptUpper.startsWith("REPEAT AFTER")
                || qPromptUpper.startsWith("LISTEN AND REPEAT")) {
            return "SHADOWING";
        }

        if (aMeta.contains("[SPEAKING_PART_2]") || aMeta.contains("SPEAKING_PART_2") || aMeta.contains("PART 2") || aMeta.contains("CUE CARD")) {
            return "PART_2";
        }
        if (aMeta.contains("[SPEAKING_PART_3]") || aMeta.contains("SPEAKING_PART_3") || aMeta.contains("PART 3") || aMeta.contains("PHẢN BIỆN")) {
            return "PART_3";
        }
        if (aMeta.contains("[SPEAKING_QA]") || aMeta.contains("SPEAKING_QA") || aMeta.contains("Q&A") || aMeta.contains("HỎI - ĐÁP") || aMeta.contains("PART 1")) {
            return "QA";
        }
        if (aMeta.contains("[SPEAKING_SHADOWING]") || aMeta.contains("SHADOWING") || aMeta.contains("ĐỌC ĐUỔI") || aMeta.contains("NHẠI GIỌNG")) {
            return "SHADOWING";
        }

        if (qPromptUpper.contains("YOU SHOULD SAY:") || qPromptUpper.contains("CUE CARD") || qPromptUpper.contains("[PART 2]")) {
            return "PART_2";
        }
        if (qPromptUpper.contains("[PART 3]") || qPromptUpper.contains("FOLLOW-UP DISCUSSION")) {
            return "PART_3";
        }

        if (question != null) {
            if (isGradingRubricOrMetaText(question.getCorrectAnswer())
                    || ((question.getTranscript() == null || question.getTranscript().isBlank()) && qPrompt.trim().endsWith("?"))) {
                return "QA";
            }
        }
        return "SHADOWING";
    }

    static boolean isNonShadowingSpeakingQuestion(Assignment assignment, AssignmentQuestion question) {
        if (question == null) {
            return isNonShadowingSpeakingAssignment(assignment);
        }
        SkillType effectiveSkill = question.getSkillType() != null
                ? question.getSkillType()
                : (assignment != null ? assignment.getSkillType() : null);
        if (effectiveSkill == SkillType.LISTENING) {
            return false;
        }
        boolean isSpeakingLike = effectiveSkill == SkillType.SPEAKING
                || question.getQuestionType() == QuestionType.AUDIO_RESPONSE;
        if (!isSpeakingLike) {
            return false;
        }
        String mode = resolveSpeakingMode(assignment, question, null);
        return !"SHADOWING".equals(mode);
    }

    static boolean isCorruptedSpeakingPrompt(AssignmentQuestion question) {
        if (question == null) {
            return true;
        }
        String prompt = question.getPromptText();
        if (prompt == null || prompt.isBlank()) {
            return true;
        }
        String trimmed = prompt.trim();
        if (trimmed.matches("^\\(?1[.)].*") && containsVietnameseDiacritics(trimmed)) {
            return true;
        }
        return isGradingRubricOrMetaText(trimmed) && containsVietnameseDiacritics(trimmed);
    }

    static String reconstructEnglishPromptForNonShadowingSpeaking(
            Assignment assignment,
            AssignmentQuestion question,
            String detectedMode) {
        if (question != null && !isCorruptedSpeakingPrompt(question)) {
            return question.getPromptText().trim();
        }
        String mode = (detectedMode != null && !detectedMode.isBlank())
                ? detectedMode.trim().toUpperCase(Locale.ROOT)
                : resolveSpeakingMode(assignment, question, null);

        String title = assignment != null && assignment.getTitle() != null ? assignment.getTitle() : "";
        String explanation = question != null && question.getExplanation() != null ? question.getExplanation() : "";
        String answer = question != null && question.getCorrectAnswer() != null ? question.getCorrectAnswer() : "";
        String prompt = question != null && question.getPromptText() != null ? question.getPromptText() : "";
        String rawContext = (title + "\n" + prompt + "\n" + answer + "\n" + explanation).toLowerCase(Locale.ROOT);

        if ("PART_2".equals(mode)) {
            if (rawContext.contains("bãi biển") || rawContext.contains("beach")) {
                return "Describe a memorable trip to the beach.\n"
                        + "You should say:\n"
                        + "- where the beach is\n"
                        + "- when you went there\n"
                        + "- what main activities you did\n"
                        + "and explain why this trip was memorable to you.";
            }
            if (rawContext.contains("giáo viên") || rawContext.contains("thầy") || rawContext.contains("cô giáo") || rawContext.contains("teacher")) {
                return "Describe a teacher you admire at school.\n"
                        + "You should say:\n"
                        + "- who this teacher is\n"
                        + "- what subject he or she teaches\n"
                        + "- what he or she is like\n"
                        + "and explain why you admire this teacher.";
            }
            if (rawContext.contains("sách") || rawContext.contains("cuốn truyện") || rawContext.contains("book")) {
                return "Describe an interesting book you have read recently.\n"
                        + "You should say:\n"
                        + "- what kind of book it is\n"
                        + "- what it is about\n"
                        + "- why you decided to read it\n"
                        + "and explain what you learned or liked most about this book.";
            }
            if (rawContext.contains("mái xanh") || rawContext.contains("môi trường") || rawContext.contains("environment") || rawContext.contains("green") || rawContext.contains("sinh thái")) {
                return "Describe an environmental initiative or green project you know about.\n"
                        + "You should say:\n"
                        + "- what the initiative is\n"
                        + "- how people put it into practice\n"
                        + "- what environmental problems it helps address\n"
                        + "and explain why you think it is beneficial for the community.";
            }
            if (rawContext.contains("kỹ năng") || rawContext.contains("skill")) {
                return "Describe a useful skill you learned recently.\n"
                        + "You should say:\n"
                        + "- what the skill is\n"
                        + "- how you learned it\n"
                        + "- why you decided to learn it\n"
                        + "and explain how this skill helps you in daily life.";
            }
            if (rawContext.contains("công viên") || rawContext.contains("park")) {
                return "Describe a park or public garden you enjoy visiting.\n"
                        + "You should say:\n"
                        + "- where it is located\n"
                        + "- who you usually go there with\n"
                        + "- what you often do there\n"
                        + "and explain why you enjoy spending time in this place.";
            }
            return "Describe a memorable experience in your life.\n"
                    + "You should say:\n"
                    + "- when and where it happened\n"
                    + "- who was involved with you\n"
                    + "- what happened during this experience\n"
                    + "and explain why it was meaningful to you.";
        }

        if ("PART_3".equals(mode)) {
            if (rawContext.contains("mái xanh") || rawContext.contains("môi trường") || rawContext.contains("environment") || rawContext.contains("green") || rawContext.contains("sinh thái")) {
                return "How can cities integrate green spaces and sustainable infrastructure like green roofs into modern urban areas to improve residents' quality of life?";
            }
            if (rawContext.contains("công nghệ") || rawContext.contains("technology")
                    || Pattern.compile("(?<![\\p{L}\\p{N}])ai(?![\\p{L}\\p{N}])").matcher(rawContext).find()) {
                return "How has modern technology changed the way people communicate and work in recent years, and do the benefits outweigh the drawbacks?";
            }
            if (rawContext.contains("giáo dục") || rawContext.contains("học tập") || rawContext.contains("education") || rawContext.contains("school")) {
                return "What are the most important qualities of an effective education system, and how should schools prepare students for future careers?";
            }
            return "What are the main advantages and challenges of this topic in modern society, and how do you expect it to develop in the future?";
        }

        // QA / Part 1 Interview
        if (rawContext.contains("mái xanh") || rawContext.contains("môi trường") || rawContext.contains("environment") || rawContext.contains("green") || rawContext.contains("sinh thái")) {
            return "How do green roofs and eco-friendly urban spaces benefit city environments and local biodiversity?";
        }
        if (rawContext.contains("bãi biển") || rawContext.contains("du lịch") || rawContext.contains("beach") || rawContext.contains("travel")) {
            return "Do you enjoy visiting the beach or traveling during your holidays? What activities do you usually do there?";
        }
        if (rawContext.contains("sở thích") || rawContext.contains("hobby") || rawContext.contains("free time")) {
            return "What do you usually enjoy doing in your free time, and why do you find that activity relaxing?";
        }
        return "Could you share your personal experience and thoughts on this topic in detail?";
    }

    static boolean isNonShadowingSpeakingAssignment(Assignment assignment) {
        if (assignment == null) {
            return false;
        }
        String title = assignment.getTitle() != null ? assignment.getTitle().toUpperCase(Locale.ROOT) : "";
        String desc = assignment.getDescription() != null ? assignment.getDescription().toUpperCase(Locale.ROOT) : "";
        String meta = title + " " + desc;

        boolean hasExplicitNonShadowTag = meta.contains("[SPEAKING_QA]")
                || meta.contains("SPEAKING_QA")
                || meta.contains("[SPEAKING_PART_2]")
                || meta.contains("SPEAKING_PART_2")
                || meta.contains("[SPEAKING_PART_3]")
                || meta.contains("SPEAKING_PART_3")
                || meta.contains("Q&A")
                || meta.contains("HỎI - ĐÁP")
                || meta.contains("PART 1")
                || meta.contains("PART 2")
                || meta.contains("PART 3")
                || meta.contains("CUE CARD")
                || meta.contains("PHẢN BIỆN");
        boolean hasExplicitShadowTag = meta.contains("[SPEAKING_SHADOWING]")
                || meta.contains("SHADOWING")
                || meta.contains("ĐỌC ĐUỔI")
                || meta.contains("NHẠI GIỌNG");

        if (hasExplicitNonShadowTag) {
            return true;
        }
        if (hasExplicitShadowTag) {
            return false;
        }

        List<AssignmentQuestion> questions = assignment.getQuestions();
        if (questions != null && !questions.isEmpty()) {
            List<AssignmentQuestion> audioOrSpeakingQs = questions.stream()
                    .filter(q -> q.getSkillType() == SkillType.SPEAKING
                            || q.getQuestionType() == QuestionType.AUDIO_RESPONSE
                            || (q.getSkillType() == null && assignment.getSkillType() == SkillType.SPEAKING))
                    .toList();
            if (!audioOrSpeakingQs.isEmpty()) {
                return audioOrSpeakingQs.stream()
                        .allMatch(q -> isNonShadowingSpeakingQuestion(assignment, q));
            }
        }
        return false;
    }

    class DialogueTurnParseResult {
        public String speaker;
        public String text;
        public String voice;
        public DialogueTurnParseResult(String speaker, String text) {
            this.speaker = speaker;
            this.text = text;
            this.voice = DEFAULT_SHADOWING_VOICE;
        }
        public String speaker() { return speaker; }
        public String text() { return text; }
        public String voice() { return voice; }
    }
}
