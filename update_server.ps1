
$path = "c:\wamp\www\game\server.js"
$content = [System.IO.File]::ReadAllText($path)

# 1. Anchor for functions insertion
$anchor = "    socket.on('pick_category', ({ roomId, category }) => {"

$functions = @"

    function startProverbsRound(room, io, roomId) {
        if (room.currentRound > room.roundCount) {
            endGame(room, io, roomId);
            return;
        }

        const q = room.questions[room.currentRound - 1];
        
        let options = q.options;
        if (!options || options.length === 0) {
            const allAnswers = proverbsPool.map(p => p.answer);
            const wrongAnswers = allAnswers.filter(a => a !== q.answer).sort(() => Math.random() - 0.5).slice(0, 3);
            options = [q.answer, ...wrongAnswers].sort(() => Math.random() - 0.5);
        }

        room.activeQuestion = { ...q, options };
        delete room.activeQuestion.answer;
        room.correctAnswer = q.answer;

        room.gameStatus = 'proverbs_active';
        room.timer = q.type === 'context' ? 20 : 15;
        room.roundSubmissions = {};
        room.wordMeaningFeedback = {}; 
        room.feedback = null;

        io.to(roomId).emit('room_data', room);

        const roundInterval = setInterval(() => {
            if (room.timer > 0 && room.gameStatus === 'proverbs_active') {
                room.timer--;
                io.to(roomId).emit('room_data', room);
            } else {
                clearInterval(roundInterval);
                if (room.gameStatus === 'proverbs_active') {
                    scoreProverbsRound(room, io, roomId);
                }
            }
        }, 1000);
    }

    function scoreProverbsRound(room, io, roomId) {
        room.gameStatus = 'proverbs_scoring';
        const q = room.questions[room.currentRound - 1];

        room.players.forEach(p => {
            const submission = room.roundSubmissions[p.id];
            if (submission && isCorrectAnswer(submission.answer, q.answer)) {
                const speedBonus = submission.timeLeft * 5;
                const totalPoints = 50 + speedBonus;
                p.score += totalPoints;

                if (!room.wordMeaningFeedback) room.wordMeaningFeedback = {};
                if (room.wordMeaningFeedback[p.id]) {
                    room.wordMeaningFeedback[p.id].pointsEarned = totalPoints;
                }
            }
        });

        room.feedback = {
            type: 'info',
            message: `الإجابة الصحيحة هي: \${q.answer}`,
            answer: q.answer
        };

        io.to(roomId).emit('room_data', room);

        setTimeout(() => {
            room.currentRound++;
            room.feedback = null;
            room.activeQuestion = null;
            startProverbsRound(room, io, roomId);
        }, 5000);
    }

    socket.on('submit_proverbs_answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room && room.gameStatus === 'proverbs_active') {
            const q = room.questions[room.currentRound - 1];
            room.roundSubmissions[socket.id] = { answer, timeLeft: room.timer };

            if (!room.wordMeaningFeedback) room.wordMeaningFeedback = {};
            room.wordMeaningFeedback[socket.id] = { answer, isCorrect: isCorrectAnswer(answer, q.answer) };

            io.to(roomId).emit('room_data', room);

            if (Object.keys(room.roundSubmissions).length === room.players.length) {
                room.timer = 0;
            }
        }
    });

"@

if ($content.Contains($anchor)) {
    $content = $content.Replace($anchor, $functions + $anchor)
    Write-Host "Inserted functions before pick_category."
} else {
    Write-Host "Could not find anchor."
}

[System.IO.File]::WriteAllText($path, $content)
