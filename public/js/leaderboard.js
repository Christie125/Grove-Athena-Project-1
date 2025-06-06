function getleaderboard() {
    fetch("/getleaderboard")
        .then(response => response.json())
        .then(data => {
        const leaderboard = document.getElementById("leaderboard");
        leaderboard.innerHTML = ""; // Clears previous entries
        const table = document.createElement("table");
        
        data.forEach((user, index) => {
            const tr = document.createElement("tr");

            //Rank column
            const tdRank = document.createElement("td");
            tdRank.textContent = index + 1; // Rankings start at 1
            tr.appendChild(tdRank);

            // Username column
            const tdUserName = document.createElement("td");
            tdUserName.textContent = user.username;
            tr.appendChild(tdUserName);

            // Points column
            const tdPoints = document.createElement("td");
            tdPoints.innerHTML = `${user.points} <span class="material-icons star">star</span>`;
            tr.appendChild(tdPoints);

            // Appending the row to the table
        table.appendChild(tr);
        console.log(`Adding user to leaderboard: ${user.username} with points: ${user.points}`);        
    });
        
    leaderboard.appendChild(table);})
         .catch(error => console.error("Error fetching leaderboard:", error));
        }

        document.addEventListener("DOMContentLoaded", () => {
            console.log("Document loaded, fetching leaderboard...");
            getleaderboard();
        });