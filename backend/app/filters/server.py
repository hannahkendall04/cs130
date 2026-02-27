from flask import Flask, request, jsonify
from skip_range import SkipRange

app = Flask(__name__)

@app.route("/process", methods=["POST"])
def process_skip():
    data = request.json
    start_ms = data["start_ms"]
    end_ms = data["end_ms"]
    category = data["category"]

    # Use SkipRange logic
    skip_range = SkipRange.from_ms(start_ms, end_ms, category)
    duration = skip_range.duration()

    return jsonify({"duration": duration, "message": "Processed successfully"})

if __name__ == "__main__":
    app.run(port=5000)