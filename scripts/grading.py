import sys
import json
import argparse

def evaluate_student(text, topic="General"):
    # Giả lập logic chấm điểm AI bằng Python (Bạn có thể dùng PyTorch, NLTK, Spacy, v.v. ở đây)
    word_count = len(text.split())
    
    # Tính điểm giả lập (thay logic AI Model của bạn vào đây)
    score = min(10.0, max(1.0, word_count / 10.0))
    
    result = {
        "score": round(score, 1),
        "feedback": f"Bài viết thuộc chủ đề '{topic}'. Số từ: {word_count}.",
        "status": "PASS" if score >= 5.0 else "FAIL"
    }
    
    # Bắt buộc phải print() ra định dạng JSON để Java đọc được từ Standard Output
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Grading Script")
    parser.add_argument("--text", type=str, required=True, help="Văn bản cần chấm")
    parser.add_argument("--topic", type=str, default="General", help="Chủ đề")
    
    args = parser.parse_args()
    evaluate_student(args.text, args.topic)
