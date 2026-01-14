import { createClient } from '@supabase/supabase-js'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import "./style.css"; 

// --- 1. KONFIGURATION ---
const SUPABASE_URL = "https://jvlzmfaqvdvqktbwvfen.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bHptZmFxdmR2cWt0Ynd2ZmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDM3OTksImV4cCI6MjA4MzAxOTc5OX0.wvg9xlSLSM7FUFX5vJmJx_WCvbNxXNgIKoaddcCc3Eo"
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --- 2. STATE --- appens korttidsminne, hur ser situationen ut just nu.
let myUserId: string | null = null;  // vem är inloggad | ingen inloggad
let currentWorkoutId: string | null = null; // vilket pass är öppet just nu | inget pass för tillfället
let currentFilter: "all" | "done" | "not-done" = "all"; // union types till filtrering där "all är default"

interface Exercise {
  id: string; name: string; sets: number; reps: number; weight: number; isDone: boolean;  // typning
}
const exercises: Array<Exercise> = []; // behållaren för övningarna som visas kopplat till interfacet ovan

// Databasrad-typer (Supabase)
interface WorkoutRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

interface ExerciseRow {
  id: string;
  workout_id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  is_done: boolean;
  created_at: string;
}

interface WorkoutLogRow {
  id: string;
  workout_id: string;
  total_volume: number;
  completed_at: string;
  workouts: {
    name: string;
    user_id: string;
  };
}

// --- 3. DOM ELEMENT ---
// APPVYER
const authView = document.getElementById("auth-view") as HTMLDivElement;
const appView = document.getElementById("app") as HTMLDivElement;
const startView = document.getElementById("start-view") as HTMLDivElement;
const workoutView = document.getElementById("workout-view") as HTMLDivElement;
const statisticsView = document.getElementById("statistics-view") as HTMLDivElement;

//LOGIN
const emailInput = document.getElementById("email-input") as HTMLInputElement;
const passwordInput = document.getElementById("password-input") as HTMLInputElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const signupBtn = document.getElementById("signup-btn") as HTMLButtonElement;
const authMessage = document.getElementById("auth-message") as HTMLParagraphElement;

// NAVIGATION
const appLogo = document.getElementById("app-logo") as HTMLElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const settingsDropdown = document.getElementById("settings-dropdown") as HTMLDivElement;
const userDisplay = document.getElementById("user-display") as HTMLDivElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

// STATS
const statsCards = document.getElementById("stats-cards") as HTMLDivElement;
const workoutLogsList = document.getElementById("workout-logs-list") as HTMLUListElement;

// DASHBOARD
const workoutNameInput = document.getElementById("workout-name-input") as HTMLInputElement;
const startWorkoutBtn = document.getElementById("start-workout-btn") as HTMLButtonElement;
const savedWorkoutsList = document.getElementById("saved-workouts-list") as HTMLUListElement;

// WORKOUT
const currentWorkoutTitle = document.getElementById("current-workout-title") as HTMLHeadingElement;
const finishWorkoutBtn = document.getElementById("finish-workout-btn") as HTMLButtonElement;
const workoutForm = document.getElementById('workout-form') as HTMLFormElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const sets = document.getElementById('sets') as HTMLInputElement;
const reps = document.getElementById('reps') as HTMLInputElement;
const weight = document.getElementById('weight') as HTMLInputElement;
const workoutList = document.getElementById("workout-list") as HTMLUListElement;
const filterSelect = document.getElementById("filter-select") as HTMLSelectElement;


// --- 4. FUNKTIONER ---

const updateNavbarState = (isDashboard: boolean) => {
    
    if (isDashboard) {                       // Visar logga och döljer pil i dashboard
        appLogo.style.display = "block";     
        backBtn.classList.add("hidden");
    } else {
    
        appLogo.style.display = "none";      // Döljer logga och visar pil i passvy
        backBtn.classList.remove("hidden");
    }
};

const goToDashboard = () => {
  currentWorkoutId = null;
  exercises.length = 0;
  workoutView.style.display = "none";
  statisticsView.style.display = "none";
  startView.style.display = "block";
  updateNavbarState(true); // Uppdatera menyn till Dashboard-läge
  fetchWorkouts();
};

// Funktionen som fyller dashboard med data
const fetchWorkouts = async () => {               
  if (!myUserId || !savedWorkoutsList) return;
  savedWorkoutsList.innerHTML = '<li style="cursor:default;">Laddar... ⏳</li>';
  
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', myUserId);
  if (error || !data) { savedWorkoutsList.innerHTML = "<li>Kunde inte hämta pass.</li>"; return; }
  
  savedWorkoutsList.innerHTML = "";
  if (data.length === 0) { savedWorkoutsList.innerHTML = "<li>Inga pass än.</li>"; return; }

  (data as WorkoutRow[]).reverse().forEach((workout: WorkoutRow) => {
    const li = document.createElement("li");
    const date = workout.created_at ? new Date(workout.created_at).toLocaleDateString() : "";
    
    li.innerHTML = `                         
      <div class="workout-info-group">
        <strong>${workout.name}</strong>
        <span class="date-tag">${date}</span>
      </div>
      <button class="delete-workout-btn" title="Radera">🗑️</button>
    `;

    li.addEventListener("click", () => loadWorkout(workout.id, workout.name));

    // Radera pass
    const delBtn = li.querySelector(".delete-workout-btn") as HTMLButtonElement; 
    delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if(confirm(`Radera "${workout.name}"?`)) {
            await supabase.from('workouts').delete().eq('id', workout.id);
            fetchWorkouts();
        }
    });

    savedWorkoutsList.appendChild(li);
  });
};

// Funktion som laddar pass och byter vy till träninsgläget efter klick på träningslistan i dashboard
const loadWorkout = async (id: string, name: string) => {
  currentWorkoutId = id;
  currentWorkoutTitle.innerText = name;
  startView.style.display = "none";
  workoutView.style.display = "block";
  statisticsView.style.display = "none";
  updateNavbarState(false);
  
  exercises.length = 0;
  workoutList.innerHTML = "Laddar...";

  const { data } = await supabase
    .from('exercises')
    .select('*')
    .eq('workout_id', id);
  if (data) {
    (data as ExerciseRow[]).forEach((dbExercise: ExerciseRow) => {
      exercises.push({
        id: dbExercise.id, name: dbExercise.name, sets: dbExercise.sets,
        reps: dbExercise.reps, weight: dbExercise.weight, isDone: dbExercise.is_done
      });
    });
  }
  renderExercises();
};

// Visa statistik-vy
const showStatistics = async () => {
  startView.style.display = "none";
  workoutView.style.display = "none";
  statisticsView.style.display = "block";
  updateNavbarState(false);
  await loadWorkoutLogs();
};

// Ladda workout logs från databasen
const loadWorkoutLogs = async () => {
  if (!myUserId) {
    console.warn('Ingen användare inloggad');
    workoutLogsList.innerHTML = '<li>Du måste vara inloggad.</li>';
    return;
  }
  
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, workout_id, total_volume, completed_at, workouts!inner(name, user_id)')
    .eq('workouts.user_id', myUserId)
    .order('completed_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Fel vid hämtning av logs:', error);
    workoutLogsList.innerHTML = '<li>Kunde inte hämta loggar.</li>';
    return;
  }

  console.log(`Laddar loggar för användare ${myUserId}:`, data);

  // Beräkna statistik för olika tidsperioder
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  let weekVolume = 0, weekCount = 0;
  let monthVolume = 0, monthCount = 0;
  let yearVolume = 0, yearCount = 0;
  let totalVolume = 0, totalCount = 0;

  // Rensa listan
  workoutLogsList.innerHTML = '';

  if (data && data.length > 0) {
    (data as WorkoutLogRow[]).forEach((log: WorkoutLogRow) => {
      const logDate = new Date(log.completed_at);
      
      // Räkna totalt
      totalVolume += log.total_volume || 0;
      totalCount += 1;

      // Räkna vecka
      if (logDate >= weekAgo) {
        weekVolume += log.total_volume || 0;
        weekCount += 1;
      }

      // Räkna månad
      if (logDate >= monthAgo) {
        monthVolume += log.total_volume || 0;
        monthCount += 1;
      }

      // Räkna år
      if (logDate >= yearAgo) {
        yearVolume += log.total_volume || 0;
        yearCount += 1;
      }

      // Lägg till i senaste pass-listan
      const logItem = document.createElement('li');
      logItem.className = 'log-item';
      const dateOnly = log.completed_at ? log.completed_at.split('T')[0] : 'Inget datum';
      logItem.innerHTML = `
        <div class="log-info">
          <div class="log-name">${log.workouts?.name || 'Okänt Pass'}</div>
          <div class="log-date">${dateOnly}</div>
        </div>
        <div class="log-volume">${log.total_volume || 0} kg</div>
      `;
      workoutLogsList.appendChild(logItem);
    });
  }

  // Visa statistik-kort
  statsCards.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-header">Senaste Veckan:</div>
      <div class="stat-card-content">
        <div>Antal Pass: <strong>${weekCount}</strong></div>
        <div>Total Volym: <strong>${weekVolume.toLocaleString()} kg</strong></div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">Senaste Månaden:</div>
      <div class="stat-card-content">
        <div>Antal Pass: <strong>${monthCount}</strong></div>
        <div>Total Volym: <strong>${monthVolume.toLocaleString()} kg</strong></div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">Hittills i År:</div>
      <div class="stat-card-content">
        <div>Antal Pass: <strong>${yearCount}</strong></div>
        <div>Total Volym: <strong>${yearVolume.toLocaleString()} kg</strong></div>
      </div>
    </div>
  `;
};

const moveExercise = (index: number, direction: 'up' | 'down') => {
  if (direction === 'up' && index > 0) {
    [exercises[index], exercises[index - 1]] = [exercises[index - 1], exercises[index]];
  } else if (direction === 'down' && index < exercises.length - 1) {
    [exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]];
  }
  renderExercises();
};

const renderExercises = () => {
  workoutList.innerHTML = "";
  const filtered = exercises.filter(e => currentFilter === "all" ? true : (currentFilter === "done" ? e.isDone : !e.isDone));

  filtered.forEach(ex => {
    const actualIndex = exercises.findIndex(e => e.id === ex.id);
    const li = document.createElement("li");
    li.className = "workout-item";
    li.innerHTML = `
      <label class="exercise-row">
        <input type="checkbox" ${ex.isDone ? "checked" : ""}>     
        <div class="info">
           <strong>${ex.name}</strong>
           <span class="details">${ex.sets} x ${ex.reps}</span>
        </div>
        <div class="weight-box">
           <input type="number" value="${ex.weight}" class="weight-input" step="0.1"><span>kg</span>
        </div>
      </label>
      <div class="action-buttons">
        <button class="sort-btn" title="Upp" ${actualIndex === 0 ? 'disabled' : ''}>↑</button>
        <button class="sort-btn" title="Ned" ${actualIndex === exercises.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="delete-btn">✕</button>
      </div>
    `;
    
    li.querySelector("input[type='checkbox']")?.addEventListener("click", async (e) => { 
        const val = (e.target as HTMLInputElement).checked;
        ex.isDone = val;
        await supabase.from('exercises').update({ is_done: val }).eq('id', ex.id);
        renderExercises();
    });

    const wInput = li.querySelector(".weight-input") as HTMLInputElement;
    wInput.addEventListener("change", async () => {
        ex.weight = Number(wInput.value);
        await supabase.from('exercises').update({ weight: ex.weight }).eq('id', ex.id);
    });

    const sortButtons = li.querySelectorAll(".sort-btn");
    if (sortButtons.length >= 2) {
      (sortButtons[0] as HTMLButtonElement).addEventListener("click", () => moveExercise(actualIndex, 'up'));
      (sortButtons[1] as HTMLButtonElement).addEventListener("click", () => moveExercise(actualIndex, 'down'));
    }

    li.querySelector(".delete-btn")?.addEventListener("click", async () => {
        await supabase.from('exercises').delete().eq('id', ex.id);
        const idx = exercises.findIndex(x => x.id === ex.id);
        if (idx > -1) exercises.splice(idx, 1);
        renderExercises();
    });

    workoutList.appendChild(li);
  });
};

const calculateTotalVolume = (): number => {
  return exercises
  .filter(ex => ex.isDone) 
  .reduce((total, ex) => {
    return total + (ex.sets * ex.reps * ex.weight);
  }, 0);
};

const logWorkoutCompletion = async (workoutId: string): Promise<boolean> => {
  const totalVolume = Math.round(calculateTotalVolume()); // bigint i DB kräver heltal
  if (totalVolume === 0) {
    alert("Du måste slutföra minst en övning innan du kan avsluta passet!");
    return false;
  }
  const completedAt = new Date().toISOString();

  const { error } = await supabase.from('workout_logs').insert({
    workout_id: workoutId,
    total_volume: totalVolume,
    completed_at: completedAt
  });

  if (error) {
    console.error('Fel vid sparning av log:', error);
    alert(`Kunde inte spara passet: ${error.message}`);
    return false;
  }

  showCompletionModal(totalVolume);
  return true;
};

const showCompletionModal = (totalVolume: number) => {
  const modal = document.createElement('div');
  modal.className = 'completion-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-icon">💪</div>
      <h2>Grattis!</h2>
      <p>Du har slutfört passet!</p>
      
      <div class="volume-box">
        <p>Total Volym</p>
        <h3 class="slot-machine">0 kg</h3>
      </div>
      
      <p class="modal-footer">Starkt jobbat, fortsätt så!</p>
      <button class="modal-btn">Stäng</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Slot machine animation för volym
  const volumeDisplay = modal.querySelector('.slot-machine') as HTMLElement;
  if (volumeDisplay) {
    volumeDisplay.classList.add('animating'); // Lägg på animationen
    const duration = 1000; // ms
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(progress * totalVolume);
      volumeDisplay.textContent = `${currentValue} kg`;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        volumeDisplay.textContent = `${totalVolume} kg`;
        volumeDisplay.classList.remove('animating'); // Ta bort animationen när den är klar
        volumeDisplay.classList.add('expand'); // Lägg på expand-animationen
        setTimeout(() => {
          volumeDisplay.classList.remove('expand');
        }, 600); // Duration av expand-animationen
      }
    };
    animate();
  }
  
  modal.querySelector('.modal-btn')?.addEventListener('click', () => {
    modal.remove();
  });
};

// --- 5. EVENT LISTENERS ---

loginBtn.addEventListener("click", async (_e: MouseEvent) => {
  const { error } = await supabase.auth.signInWithPassword({ email: emailInput.value, password: passwordInput.value });
  if (error) authMessage.innerText = error.message;
});

signupBtn.addEventListener("click", async (_e: MouseEvent) => {
  const { data, error } = await supabase.auth.signUp({ email: emailInput.value, password: passwordInput.value });
  if (error) { authMessage.innerText = error.message; return; }
  if (data.user && usernameInput.value) await supabase.from('users').insert({ id: data.user.id, email: emailInput.value, name: usernameInput.value });
  alert("Konto skapat!");
});

logoutBtn?.addEventListener("click", async (_e: MouseEvent) => {
    await supabase.auth.signOut();
    settingsDropdown.classList.add("hidden");
});

supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
  if (session?.user) {
    myUserId = session.user.id;
    authView.style.display = "none";
    appView.style.display = "block";
    updateNavbarState(true);
    
    if (userDisplay) userDisplay.innerText = session.user.email || "Användare";
    
    fetchWorkouts();
  } else {
    myUserId = null;
    authView.style.display = "block";
    appView.style.display = "none";
  }
});

// Navigation
backBtn?.addEventListener("click", (_e: MouseEvent) => {
    goToDashboard();
    settingsDropdown.classList.add("hidden");
});

settingsBtn?.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e: MouseEvent) => {
    if (settingsDropdown && !settingsDropdown.classList.contains("hidden") && !settingsDropdown.contains(e.target as Node) && e.target !== settingsBtn) {
        settingsDropdown.classList.add("hidden");
    }
});

const statsBtn = document.getElementById("stats-btn") as HTMLButtonElement;

statsBtn?.addEventListener('click', () => {
  settingsDropdown.classList.add('hidden');
  showStatistics();
});

// App Logic
startWorkoutBtn?.addEventListener("click", async (_e: MouseEvent) => {
    const name = workoutNameInput.value;
    if (!name) return alert("Ange namn");
    const { data } = await supabase.from('workouts').insert({ name, user_id: myUserId }).select().single();
    if (data) loadWorkout(data.id, data.name);
    workoutNameInput.value = "";
});

finishWorkoutBtn?.addEventListener("click", async (_e: MouseEvent) => {
  if (currentWorkoutId) {
    const ok = await logWorkoutCompletion(currentWorkoutId);
    if (!ok) return; // avbryt om loggning misslyckas eller volymen är 0

    exercises.forEach(ex => {
      ex.isDone = false;
    });
    await supabase.from('exercises').update({ is_done: false }).eq('workout_id', currentWorkoutId);
    renderExercises();
  }
  goToDashboard();
});

workoutForm?.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
    if (!currentWorkoutId) return;
    const newEx = { workout_id: currentWorkoutId, name: nameInput.value, sets: +sets.value, reps: +reps.value, weight: +weight.value, is_done: false };
    const { data } = await supabase
      .from('exercises')
      .insert(newEx)
      .select()
      .single();
    if (data) {
        const row = data as ExerciseRow;
        exercises.push({ id: row.id, name: row.name, sets: row.sets, reps: row.reps, weight: row.weight, isDone: row.is_done });
        renderExercises();
        workoutForm.reset();
        nameInput.focus();
    }
});

filterSelect?.addEventListener("change", () => {
  currentFilter = filterSelect.value as 'all' | 'done' | 'not-done';
    renderExercises();
});
