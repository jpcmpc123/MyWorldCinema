"""
Servidor Web FastAPI para Recomendação de Filmes com Laya + TMDB.
Executa tanto a API REST (/api/recommend) quanto uma interface HTML bonita e moderna para o usuário.
"""

import os
import json
import urllib.parse
import urllib.request
import random
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, JSONResponse
import laya

app = FastAPI(title="Laya TMDB Movie Recommender API")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_checkpoint")
QUESTIONS_PATH = os.path.join(os.path.dirname(__file__), "movie_questions.json")
TMDB_KEY = os.environ.get("TMDB_API_KEY") or os.environ.get("TMDB_READ_TOKEN") or "756b66f23e97ca70dba67363ba4e3b21"

# Carrega agente Laya na inicialização
print(f"[API] Carregando modelo Laya a partir de: {MODEL_PATH}")
agent = laya.load(MODEL_PATH)
with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
    questions = json.load(f)

TMDB_GENRE_MAP = {
    "action": 28, "adventure": 12, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 14, "history": 36, "horror": 27, "music": 10402,
    "mystery": 9648, "romance": 10749, "scifi": 878, "thriller": 53,
    "war": 10752, "western": 37
}

DECADE_YEAR_MAP = {
    "80s": ("1980-01-01", "1989-12-31"),
    "90s": ("1990-01-01", "1999-12-31"),
    "2000s": ("2000-01-01", "2009-12-31"),
    "modern": ("2010-01-01", "2026-12-31")
}

ORIGIN_MAP = {
    "korean": {"with_original_language": "ko"},
    "national": {"with_origin_country": "BR", "with_original_language": "pt"},
    "european": {"with_origin_country": "FR|IT|ES|GB|DE"},
    "hollywood": {"with_original_language": "en"}
}

def extract_val(ans):
    if isinstance(ans, dict):
        return ans.get("choice", ans.get("value"))
    return ans

def query_tmdb(genre, rating, decade, origin):
    genre_id = TMDB_GENRE_MAP.get(genre)
    base_url = "https://api.themoviedb.org/3/discover/movie"
    params = {
        "language": "pt-BR",
        "sort_by": random.choice(["popularity.desc", "vote_average.desc"]),
        "vote_count.gte": "20",
        "page": str(random.randint(1, 2))
    }
    if genre_id:
        params["with_genres"] = str(genre_id)
    if decade in DECADE_YEAR_MAP:
        params["primary_release_date.gte"], params["primary_release_date.lte"] = DECADE_YEAR_MAP[decade]
    if origin in ORIGIN_MAP:
        params.update(ORIGIN_MAP[origin])
    if rating and rating in ["L", "10", "12", "14", "16", "18"] and origin != "korean":
        params["certification_country"] = "BR"
        params["certification.lte"] = rating

    headers = {"User-Agent": "LayaAPI/1.0", "accept": "application/json"}
    if len(TMDB_KEY) > 50:
        headers["Authorization"] = f"Bearer {TMDB_KEY}"
    else:
        params["api_key"] = TMDB_KEY

    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            movies = []
            for m in data.get("results", [])[:6]:
                poster_path = m.get("poster_path")
                poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
                movies.append({
                    "title": m.get("title"),
                    "overview": m.get("overview") or "Sem sinopse disponível.",
                    "vote_average": m.get("vote_average", 0),
                    "release_date": m.get("release_date", ""),
                    "poster_url": poster_url
                })
            return movies
    except Exception as e:
        print(f"Erro na chamada TMDB: {e}")
        return []

@app.get("/api/recommend")
def api_recommend(q: str = Query(..., description="Pedido em linguagem natural")):
    prediction = agent.predict(q, questions)
    answers = prediction.get("answers", {})

    genre = extract_val(answers.get("genre"))
    mood = extract_val(answers.get("mood"))
    rating = extract_val(answers.get("content_rating"))
    decade = extract_val(answers.get("decade"))
    origin = extract_val(answers.get("origin"))

    movies = query_tmdb(genre, rating, decade, origin)
    return {
        "query": q,
        "decisions": {
            "genre": genre,
            "mood": mood,
            "content_rating": rating,
            "decade": decade,
            "origin": origin
        },
        "movies": movies
    }

@app.get("/", response_class=HTMLResponse)
def index():
    return """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CineLaya - Recomendador Inteligente com IA</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: #0f172a; color: #f8fafc; min-height: 100vh; padding: 40px 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { font-size: 2.5rem; text-align: center; margin-bottom: 8px; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p.subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 1.05rem; }
        .search-box { display: flex; gap: 10px; margin-bottom: 30px; }
        input[type="text"] { flex: 1; padding: 16px 20px; font-size: 1.1rem; border-radius: 12px; border: 1px solid #334155; background: #1e293b; color: #fff; outline: none; transition: border-color 0.2s; }
        input[type="text"]:focus { border-color: #38bdf8; }
        button { padding: 16px 30px; font-size: 1.1rem; font-weight: 600; border-radius: 12px; border: none; background: #38bdf8; color: #0f172a; cursor: pointer; transition: transform 0.1s, background 0.2s; }
        button:hover { background: #0ea5e9; }
        button:active { transform: scale(0.98); }
        .tags-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 30px; }
        .tag-pill { background: #1e293b; border: 1px solid #334155; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; color: #94a3b8; cursor: pointer; transition: all 0.2s; }
        .tag-pill:hover { border-color: #38bdf8; color: #38bdf8; }
        .decision-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 15px 20px; margin-bottom: 30px; display: none; }
        .decision-card h3 { font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8; margin-bottom: 10px; }
        .decision-badges { display: flex; flex-wrap: wrap; gap: 10px; }
        .badge { background: #0f172a; border: 1px solid #475569; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; }
        .badge span { color: #38bdf8; font-weight: 600; }
        .movies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
        .movie-card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; display: flex; flex-direction: column; transition: transform 0.2s; }
        .movie-card:hover { transform: translateY(-4px); border-color: #475569; }
        .movie-poster { width: 100%; height: 350px; object-fit: cover; background: #334155; }
        .movie-info { padding: 16px; flex: 1; display: flex; flex-direction: column; }
        .movie-title { font-size: 1.15rem; font-weight: 600; margin-bottom: 6px; }
        .movie-meta { display: flex; justify-content: space-between; font-size: 0.85rem; color: #fbbf24; margin-bottom: 10px; font-weight: 600; }
        .movie-overview { font-size: 0.85rem; color: #94a3b8; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .loading { text-align: center; padding: 40px; font-size: 1.2rem; color: #38bdf8; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 CineLaya</h1>
        <p class="subtitle">Recomendador com IA (Laya System 1 em 30ms + Catálogo Oficial TMDB)</p>

        <div class="search-box">
            <input type="text" id="promptInput" placeholder="Ex: Dorama coreano de romance emocionante lançamento recente..." autofocus>
            <button onclick="buscarFilmes()">Recomendar</button>
        </div>

        <div class="tags-bar">
            <div class="tag-pill" onclick="setQuery('Comédia brasileira recente para rir bastante')">🇧🇷 Comédia Brasileira</div>
            <div class="tag-pill" onclick="setQuery('Dorama coreano de romance emocionante lançamento recente')">🇰🇷 Romance Coreano</div>
            <div class="tag-pill" onclick="setQuery('Ficção científica dos anos 80 nostálgica no espaço')">🚀 Sci-Fi Anos 80</div>
            <div class="tag-pill" onclick="setQuery('Terror pesado dos anos 90 com serial killer')">🩸 Terror Anos 90</div>
            <div class="tag-pill" onclick="setQuery('Ação frenética moderna com perseguição e lutas')">💥 Ação Moderna</div>
        </div>

        <div class="decision-card" id="decisionBox">
            <h3>⚡ Decisão Tipada Instantânea do Laya</h3>
            <div class="decision-badges" id="decisionBadges"></div>
        </div>

        <div class="loading" id="loading">Analisando o pedido com a IA e buscando no TMDB...</div>
        <div class="movies-grid" id="moviesGrid"></div>
    </div>

    <script>
        document.getElementById('promptInput').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') buscarFilmes();
        });

        function setQuery(text) {
            document.getElementById('promptInput').value = text;
            buscarFilmes();
        }

        async function buscarFilmes() {
            const q = document.getElementById('promptInput').value.trim();
            if (!q) return;

            document.getElementById('loading').style.display = 'block';
            document.getElementById('decisionBox').style.display = 'none';
            document.getElementById('moviesGrid').innerHTML = '';

            try {
                const res = await fetch(`/api/recommend?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                
                document.getElementById('loading').style.display = 'none';
                
                // Exibe badges da decisão do Laya
                const dec = data.decisions;
                const badges = [
                    `Gênero: <span>${dec.genre}</span>`,
                    `Vibe: <span>${dec.mood}</span>`,
                    `Classificação: <span>${dec.content_rating}</span>`,
                    `Década: <span>${dec.decade}</span>`,
                    `Origem: <span>${dec.origin}</span>`
                ];
                document.getElementById('decisionBadges').innerHTML = badges.map(b => `<div class="badge">${b}</div>`).join('');
                document.getElementById('decisionBox').style.display = 'block';

                // Exibe filmes
                const grid = document.getElementById('moviesGrid');
                if (data.movies.length === 0) {
                    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#94a3b8;">Nenhum filme encontrado para esses critérios exatos. Tente outra busca!</p>';
                    return;
                }

                data.movies.forEach(m => {
                    const poster = m.poster_url ? `<img class="movie-poster" src="${m.poster_url}" alt="${m.title}">` : '<div class="movie-poster" style="display:flex;align-items:center;justify-content:center;color:#64748b;">Sem Pôster</div>';
                    grid.innerHTML += `
                        <div class="movie-card">
                            ${poster}
                            <div class="movie-info">
                                <div class="movie-title">${m.title}</div>
                                <div class="movie-meta">
                                    <span>★ ${m.vote_average.toFixed(1)}</span>
                                    <span>${m.release_date.substring(0, 4)}</span>
                                </div>
                                <div class="movie-overview">${m.overview}</div>
                            </div>
                        </div>
                    `;
                });

            } catch (err) {
                document.getElementById('loading').style.display = 'none';
                alert('Erro ao buscar recomendação: ' + err.message);
            }
        }
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
