import { createClient } from '@supabase/supabase-js'
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
  id: string; name: string; sets: number; reps: number; weight: number; isDone: boolean; // typning
}
const exercises: Array<Exercise> = []; // behållaren för övningarna som visas kopplat till interfacet ovan

// --- 3. DOM ELEMENT ---
// APPVYER
const authView = document.getElementById("auth-view") as HTMLDivElement;
const appView = document.getElementById("app") as HTMLDivElement;
const startView = document.getElementById("start-view") as HTMLDivElement;
const workoutView = document.getElementById("workout-view") as HTMLDivElement;

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
        appLogo.style.display = "block";     // Inkonsekventa sätt att dölja och visa element pga att koden växt fram gradvis
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
  startView.style.display = "block";
  updateNavbarState(true); // Uppdatera menyn till Dashboard-läge
  fetchWorkouts();
};

// Funktionen som fyller dashboard med data
const fetchWorkouts = async () => {               
  if (!myUserId || !savedWorkoutsList) return;    //  Bryt om det inte användare eller <ul> på skärmen
  savedWorkoutsList.innerHTML = '<li style="cursor:default;">Laddar... ⏳</li>';
  
  const { data, error } = await supabase.from('workouts').select('*').eq('user_id', myUserId);  //Anropar databasen, gå till tabellen 'workouts', hämta all infomration där user_id är MITT id.
  if (error || !data) { savedWorkoutsList.innerHTML = "<li>Kunde inte hämta pass.</li>"; return; } // Felhantering eller tom lista
  
  savedWorkoutsList.innerHTML = "";
  if (data.length === 0) { savedWorkoutsList.innerHTML = "<li>Inga pass än.</li>"; return; }

  data.reverse().forEach(workout => {           // skapar listan och lägger det senaste passet högst upp
    const li = document.createElement("li");
    const date = workout.created_at ? new Date(workout.created_at).toLocaleDateString() : ""; // Gör om datum till läsbart format
    
    // renderar varje pass i listan med radera-knapp
    
    li.innerHTML = `                         
      <div class="workout-info-group">
        <strong>${workout.name}</strong>
        <span class="date-tag">${date}</span>
      </div>
      <button class="delete-workout-btn" title="Radera">🗑️</button>
    `;

    li.addEventListener("click", () => loadWorkout(workout.id, workout.name)); // Gör listitem klickbart och laddar passet till nästa vy

    // Radera pass
    const delBtn = li.querySelector(".delete-workout-btn") as HTMLButtonElement; 
    delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();                           // Stoppar klicket från att sprida sig, ett måste om en knapp är inuti något annat som är klickbart
        if(confirm(`Radera "${workout.name}"?`)) {         // Öppnar websläsarens inbyggda popup och frågar om du är säker på att radera passet
            await supabase.from('workouts').delete().eq('id', workout.id); //Raderar specificerat pass i databasen om radering är bekräftad
            fetchWorkouts(); // uppdaterar listan efter radering
        }
    });

    savedWorkoutsList.appendChild(li);  // Ritar om ny uppdaterad lista
  });
};

// Funktion som laddar pass och byter vy till träninsgläget efter klick på träningslistan i dashboard
const loadWorkout = async (id: string, name: string) => {
  currentWorkoutId = id;   // sparar passets id i minnet i fall man ska lägga till eller göra ändringar
  currentWorkoutTitle.innerText = name; // Ändrar texten till passets namn högst upp
  startView.style.display = "none"; // släcker dashboard
  workoutView.style.display = "block"; // tänder träningsvyn
  updateNavbarState(false); // Uppdatera menyn till Pass-läge (visa pil)
  
  exercises.length = 0;  // tömmer lådan på innehåll
  workoutList.innerHTML = "Laddar...";

  const { data } = await supabase.from('exercises').select('*').eq('workout_id', id);  // hämtar data från databasen
  if (data) {
    data.forEach(dbExercise => {              
      exercises.push({                                                    // översätter databasens språk till programspråk. Hade kunnat gjort en "adapter" som ber supabase döpa om data innan den skickar det.
        id: dbExercise.id, name: dbExercise.name, sets: dbExercise.sets,
        reps: dbExercise.reps, weight: dbExercise.weight, isDone: dbExercise.is_done
      });
    });
  }
  renderExercises();
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
  workoutList.innerHTML = "";   // tömmer listan och börjar på noll
  const filtered = exercises.filter(e => currentFilter === "all" ? true : (currentFilter === "done" ? e.isDone : !e.isDone)); // bestämmer vad som ska renderas baserat på currentFilter-variabeln

  filtered.forEach(ex => {                  // loopar igenom filtret resultat och renderar ut i html
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
           <input type="number" value="${ex.weight}" class="weight-input"><span>kg</span>
        </div>
      </label>
      <div class="action-buttons">
        <button class="sort-btn" title="Upp" ${actualIndex === 0 ? 'disabled' : ''}>↑</button>
        <button class="sort-btn" title="Ned" ${actualIndex === exercises.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="delete-btn">✕</button>
      </div>
    `;
    
    li.querySelector("input[type='checkbox']")?.addEventListener("click", async (e) => { 
        const val = (e.target as HTMLInputElement).checked;  // Är den ikryssad?
        ex.isDone = val;    // uppdatera lokalt minne
        await supabase.from('exercises').update({ is_done: val }).eq('id', ex.id);  // spara till databasen
        renderExercises();  // renderar om listan om filtret är inställt på att visa oklara övningar
    });

    const wInput = li.querySelector(".weight-input") as HTMLInputElement;  // ändrar vikten i övningen
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
        await supabase.from('exercises').delete().eq('id', ex.id); // raderar övningen från databasen
        const idx = exercises.findIndex(x => x.id === ex.id); // tar reda på index i lokala minnet och raderar
        if (idx > -1) exercises.splice(idx, 1);
        renderExercises(); // renderar om listan
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

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
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