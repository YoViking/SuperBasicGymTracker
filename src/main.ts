import { createClient } from '@supabase/supabase-js'
import "./style.css"; 

// --- 1. KONFIGURATION ---
const SUPABASE_URL = "https://jvlzmfaqvdvqktbwvfen.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bHptZmFxdmR2cWt0Ynd2ZmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDM3OTksImV4cCI6MjA4MzAxOTc5OX0.wvg9xlSLSM7FUFX5vJmJx_WCvbNxXNgIKoaddcCc3Eo"
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --- 2. STATE ---
let myUserId: string | null = null; 
let currentWorkoutId: string | null = null; 
let currentFilter: "all" | "done" | "not-done" = "all";

interface Exercise {
  id: string; name: string; sets: number; reps: number; weight: number; isDone: boolean;
}
const exercises: Array<Exercise> = [];

// --- 3. DOM ELEMENT ---
const authView = document.getElementById("auth-view") as HTMLDivElement;
const appView = document.getElementById("app") as HTMLDivElement;
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

// APP VYER
const startView = document.getElementById("start-view") as HTMLDivElement;
const workoutView = document.getElementById("workout-view") as HTMLDivElement;

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
    // Om vi är på dashboard: Visa Logga, Dölj Pil
    if (isDashboard) {
        appLogo.style.display = "block";
        backBtn.classList.add("hidden");
    } else {
    // Om vi är i ett pass: Dölj Logga, Visa Pil
        appLogo.style.display = "none";
        backBtn.classList.remove("hidden");
    }
};

const goToDashboard = () => {
  currentWorkoutId = null;
  exercises.length = 0;
  workoutView.style.display = "none";
  startView.style.display = "block";
  updateNavbarState(true); // Uppdatera menyn till Dashboard-läge
  fetchWorkouts();
};

const fetchWorkouts = async () => {
  if (!myUserId || !savedWorkoutsList) return;
  savedWorkoutsList.innerHTML = '<li style="cursor:default;">Laddar... ⏳</li>';
  
  const { data, error } = await supabase.from('workouts').select('*').eq('user_id', myUserId);
  if (error || !data) { savedWorkoutsList.innerHTML = "<li>Kunde inte hämta pass.</li>"; return; }
  
  savedWorkoutsList.innerHTML = "";
  if (data.length === 0) { savedWorkoutsList.innerHTML = "<li>Inga pass än.</li>"; return; }

  data.reverse().forEach(workout => {
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

const loadWorkout = async (id: string, name: string) => {
  currentWorkoutId = id;
  currentWorkoutTitle.innerText = name;
  startView.style.display = "none";
  workoutView.style.display = "block";
  updateNavbarState(false); // Uppdatera menyn till Pass-läge (visa pil)
  
  exercises.length = 0;
  workoutList.innerHTML = "Laddar...";

  const { data } = await supabase.from('exercises').select('*').eq('workout_id', id);
  if (data) {
    data.forEach(dbExercise => {
      exercises.push({
        id: dbExercise.id, name: dbExercise.name, sets: dbExercise.sets,
        reps: dbExercise.reps, weight: dbExercise.weight, isDone: dbExercise.is_done
      });
    });
  }
  renderExercises();
};

const renderExercises = () => {
  workoutList.innerHTML = "";
  const filtered = exercises.filter(e => currentFilter === "all" ? true : (currentFilter === "done" ? e.isDone : !e.isDone));

  filtered.forEach(ex => {
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
           <input type="number" value="${ex.weight}" class="weight-input"><span>kg</span>
        </div>
      </label>
      <button class="delete-btn">🗑️</button>
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

    li.querySelector(".delete-btn")?.addEventListener("click", async () => {
        await supabase.from('exercises').delete().eq('id', ex.id);
        const idx = exercises.findIndex(x => x.id === ex.id);
        if (idx > -1) exercises.splice(idx, 1);
        renderExercises();
    });

    workoutList.appendChild(li);
  });
};


// --- 5. EVENT LISTENERS ---

loginBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithPassword({ email: emailInput.value, password: passwordInput.value });
  if (error) authMessage.innerText = error.message;
});

signupBtn.addEventListener("click", async () => {
  const { data, error } = await supabase.auth.signUp({ email: emailInput.value, password: passwordInput.value });
  if (error) { authMessage.innerText = error.message; return; }
  if (data.user && usernameInput.value) await supabase.from('users').insert({ id: data.user.id, email: emailInput.value, name: usernameInput.value });
  alert("Konto skapat!");
});

logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    settingsDropdown.classList.add("hidden");
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    myUserId = session.user.id;
    authView.style.display = "none";
    appView.style.display = "block";
    updateNavbarState(true); // Visa Logga som standard
    
    if (userDisplay) userDisplay.innerText = session.user.email || "Användare";
    
    fetchWorkouts();
  } else {
    myUserId = null;
    authView.style.display = "block";
    appView.style.display = "none";
  }
});

// Navigation
backBtn?.addEventListener("click", () => {
    goToDashboard();
    settingsDropdown.classList.add("hidden");
});

settingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    if (settingsDropdown && !settingsDropdown.classList.contains("hidden") && !settingsDropdown.contains(e.target as Node) && e.target !== settingsBtn) {
        settingsDropdown.classList.add("hidden");
    }
});

// App Logic
startWorkoutBtn?.addEventListener("click", async () => {
    const name = workoutNameInput.value;
    if (!name) return alert("Ange namn");
    const { data } = await supabase.from('workouts').insert({ name, user_id: myUserId }).select().single();
    if (data) loadWorkout(data.id, data.name);
    workoutNameInput.value = "";
});

finishWorkoutBtn?.addEventListener("click", async () => {
    if (currentWorkoutId) {
        // Nollställ checkboxar
        await supabase.from('exercises').update({ is_done: false }).eq('workout_id', currentWorkoutId);
    }
    goToDashboard();
});

workoutForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentWorkoutId) return;
    const newEx = { workout_id: currentWorkoutId, name: nameInput.value, sets: +sets.value, reps: +reps.value, weight: +weight.value, is_done: false };
    const { data } = await supabase.from('exercises').insert(newEx).select().single();
    if (data) {
        exercises.push({ id: data.id, name: data.name, sets: data.sets, reps: data.reps, weight: data.weight, isDone: data.is_done });
        renderExercises();
        workoutForm.reset();
        nameInput.focus();
    }
});

filterSelect?.addEventListener("change", () => {
    currentFilter = filterSelect.value as any;
    renderExercises();
});