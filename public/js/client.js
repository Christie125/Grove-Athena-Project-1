function showHabit(habit) {
  const habitsDiv = document.createElement('div');
  habitsDiv.className = 'habits_div';

  const habitHeadingContainer = document.createElement('div');
  habitHeadingContainer.className = 'habit_name_heading';

  const habitNameDiv = document.createElement('div');
  habitNameDiv.className = 'habit_name';

  const habitHeading = document.createElement('h2');
  habitHeading.className = 'habit_name_heading';
  habitHeading.textContent = habit.name;
  habitNameDiv.appendChild(habitHeading);

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'habit_buttons';

  const deleteButton = document.createElement('span');
  deleteButton.className = 'material-symbols-outlined delete-button';
  deleteButton.textContent = 'delete';

  buttonContainer.appendChild(deleteButton);
  habitHeadingContainer.appendChild(habitHeading); 
  habitHeadingContainer.appendChild(buttonContainer);
  habitNameDiv.appendChild(habitHeadingContainer);

  const habitDescDiv = document.createElement('div');
  habitDescDiv.className = 'habit_description';
  const descH2 = document.createElement('h3');
  descH2.textContent = habit.description;
  descH2.className = 'habit_description';
  habitDescDiv.appendChild(descH2);

  const habitFreqDiv = document.createElement('div');
  habitFreqDiv.className = 'habit_frequency';

for (let i = 0; i < habit.frequency; i++) {
  const checkboxId = `checkbox_${habit.name.replace(/\s+/g, '_')}_${i}`;
  const checkbox = document.createElement('input');
  checkbox.className = 'habit_frequency_checkbox';
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute('id', checkboxId);
  checkbox.setAttribute('name', `checkbox_${habit.name.replace(/\s+/g, '_')}`);

  const locked = localStorage.getItem(checkboxId);
  if (locked === 'true') {
    checkbox.checked = true;
    checkbox.disabled = true;
  }

  habitFreqDiv.appendChild(checkbox);
}


  habitsDiv.appendChild(habitNameDiv);
  habitsDiv.appendChild(habitDescDiv);
  habitsDiv.appendChild(habitFreqDiv);

  document.getElementById('habitsContainer').appendChild(habitsDiv);
}

document.addEventListener("DOMContentLoaded", () => {
    
     if (typeof userHabits !== "undefined") {
        userHabits.forEach(habit => {
            showHabit({
                name: habit.habit,
                description: habit.habit_note,
                frequency: habit.how_often_habit
            });
        });
    }
    
    const addHabitForm = document.getElementById("add-habit-form");

    if (addHabitForm) {
        addHabitForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const name = document.getElementById("new_habit").value.trim();
            const description = document.getElementById("new_habit_details").value.trim();
            const frequency = document.getElementById("how_often_habit").value.trim();

            if (!name || !description || !frequency) {
                alert("Please fill in all fields.");
                return;
            }

            try {
                const response = await fetch("/add-habit", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ name, description, frequency }),
                });

                if (response.ok) {
                    const result = await response.json();
                    alert(result.message);
                    addHabitForm.reset();
                    showHabit({ name, description, frequency });
                } else {
                    const errorText = await response.text();
                    alert(`Error: ${errorText}`);
                }
            } catch (error) {
                console.error("Error submitting habit:", error);
                alert("An error occurred. Please try again.");
            }
        });
    }

    // event listener for all checkboxes inside habitsContainer
    document.getElementById('habitsContainer').addEventListener('change', async (event) => {
        if (event.target.classList.contains('habit_frequency_checkbox')) {
            const checkbox = event.target;
            const habitDiv = checkbox.closest('.habits_div');
            const habitName = habitDiv.querySelector('.habit_name h2.habit_name_heading').textContent.trim();
            console.log(`Checkbox for ${habitName} changed: ${checkbox.checked}`);
            // update points in the database
            const response = await fetch('/update-points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
            });

            await updatePointsUI(); 

            // Counts how many checkboxes are checked for this habit
            const checkboxes = habitDiv.querySelectorAll('.habit_frequency_checkbox');
            const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            const totalCount = checkboxes.length;
            if (checkedCount === totalCount) {
                alert(`All checkboxes for ${habitName} are checked.`);
            }
            //prevent re-checking the checkbox
            if (checkbox.checked) {
            // Lock the checkbox immediately
            checkbox.disabled = true;

            // Save lock state to localStorage
            const checkboxId = checkbox.id;
            localStorage.setItem(checkboxId, 'true');
            }

        }
    });
});

function resetDailyStorage() {
  const lastReset = localStorage.getItem('lastResetDate');
  const today = new Date().toISOString().split('T')[0]; // Format: "YYYY-MM-DD"

  if (lastReset !== today) {
    localStorage.clear();
    localStorage.setItem('lastResetDate', today);
    console.log('Storage reset for a new day:', today);
  } else {
    console.log('Storage already reset today.');
  }
}

resetDailyStorage();


function scheduleDailyMidnightTask(task) {
  function runAtNextMidnight() {
    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 0
    );
    const timeUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      task();
      setTimeout(runAtNextMidnight, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }

  runAtNextMidnight();
}


function resetTasks() {
  localStorage.clear();
  localStorage.setItem('lastResetDate', new Date().toISOString().split('T')[0]);
}

resetDailyStorage(); // Check on app start
scheduleDailyMidnightTask(resetTasks); // Run while app is open

document.getElementById('habitsContainer').addEventListener('click', (event) => {
    if (event.target.classList.contains('delete-button')) {
        const habitDiv = event.target.closest('.habits_div');
        if (habitDiv) {
            habitDiv.remove();
            alert('Habit deleted successfully.');
        }
        // send a request to the server to delete the habit from the database	
            const habitName = habitDiv.querySelector('.habit_name h2.habit_name_heading').textContent.trim();
        fetch('/delete-habit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ habitId: habitName })
        })
    }
});

async function updatePointsUI() {
    try {
        const res = await fetch('/get-points', {
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok && data.points !== undefined) {
            const display = document.getElementById('points-display');
            if (display) display.textContent = data.points;
        }
    } catch (err) {
        console.error("Error fetching updated points:", err);
    }
}