---
title: Videos
icon: fas fa-film
order: 5
---

<div class="video-library">
{% for group in site.data.videos %}
  <section class="video-category">
    <h2>{{ group.category }}</h2>
    <div class="video-grid">
      {% for video in group.videos %}
        {% assign url = video.url %}
        {% assign vid = '' %}
        {% if url contains 'watch?v=' %}
          {% assign vid = url | split: 'v=' | last | split: '&' | first %}
        {% elsif url contains 'youtu.be/' %}
          {% assign vid = url | split: 'youtu.be/' | last | split: '?' | first %}
        {% elsif url contains '/shorts/' %}
          {% assign vid = url | split: '/shorts/' | last | split: '?' | first %}
        {% elsif url contains '/embed/' %}
          {% assign vid = url | split: '/embed/' | last | split: '?' | first %}
        {% endif %}
        <div class="yt-card">
          <div class="yt-thumb" data-yt-id="{{ vid }}" role="button" tabindex="0" aria-label="Play {{ video.title | default: 'video' }}">
            <img src="https://img.youtube.com/vi/{{ vid }}/hqdefault.jpg" loading="lazy" alt="{{ video.title | default: 'YouTube video thumbnail' }}">
            <span class="yt-play"><i class="fas fa-play"></i></span>
          </div>
          {% if video.title %}
          <div class="yt-body">
            <p class="yt-title">{{ video.title }}</p>
          </div>
          {% endif %}
        </div>
      {% endfor %}
    </div>
  </section>
{% endfor %}
</div>

<style>
.video-library { margin-top: 0.5rem; }

.video-category { margin-bottom: 2.5rem; }
.video-category > h2 {
  margin: 0 0 1.1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--main-border-color);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--heading-color);
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.yt-card {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.yt-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--card-shadow), 0 8px 22px rgba(0, 0, 0, 0.14);
}

.yt-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  cursor: pointer;
  background: #000;
}
.yt-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}
.yt-card:hover .yt-thumb img { transform: scale(1.04); }
.yt-thumb iframe { width: 100%; height: 100%; border: 0; display: block; }

.yt-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
  transition: background 0.18s ease;
}
.yt-play::before {
  content: "";
  position: absolute;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  transition: background 0.18s ease, transform 0.18s ease;
}
.yt-play i {
  position: relative;
  color: #fff;
  font-size: 1.25rem;
  margin-left: 0.15rem; /* optically center the triangle */
}
.yt-thumb:hover .yt-play { background: rgba(0, 0, 0, 0.28); }
.yt-thumb:hover .yt-play::before {
  background: #e62117; /* YouTube red on hover */
  transform: scale(1.08);
}
.yt-thumb:focus-visible {
  outline: 2px solid var(--link-color, #0056b2);
  outline-offset: 2px;
}

.yt-body { padding: 0.7rem 0.85rem 0.9rem; }
.yt-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.yt-thumb').forEach(function (el) {
    function play() {
      var id = el.getAttribute('data-yt-id');
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      el.replaceWith(iframe);
    }
    el.addEventListener('click', play);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        play();
      }
    });
  });
});
</script>
