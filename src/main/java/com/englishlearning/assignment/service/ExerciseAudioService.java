package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.AudioGeneratedBy;

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
            String inside = matcher.group(1).trim();
            if (inside.split("\\s+").length >= 2 || inside.length() >= 8) {
                s = inside;
            }
        } else if (s.contains(":")) {
            String[] parts = s.split(":");
            String lastPart = parts[parts.length - 1].trim();
            if (!lastPart.isBlank() && (lastPart.split("\\s+").length >= 2 || lastPart.length() >= 8)) {
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
