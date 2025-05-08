//@ts-nocheck
import { useEffect, useState } from "react";
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import "../styles/global.css";
import logo from '../asset/logo.png';
import Head from 'next/head';
import Image from 'next/image';
import * as d3 from 'd3';
import Papa from 'papaparse';
import * as d3Sankey from 'd3-sankey';

const CSV_URL = 'https://raw.githubusercontent.com/KGeorgii/Chasy_data/refs/heads/main/chasy_git.csv'; // Replace with the actual URL
const WORLD_MAP_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

const Visualizations: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [worldData, setWorldData] = useState<any>(null);

  useEffect(() => {
    // Fetch data from GitHub
    const getData = async () => {
      try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error('Failed to fetch CSV from GitHub');

        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            setData(result.data);
          },
        });

        // Fetch world map GeoJSON
        const mapResponse = await fetch(WORLD_MAP_URL);
        if (!mapResponse.ok) throw new Error('Failed to fetch world map data');
        const mapData = await mapResponse.json();
        setWorldData(mapData);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    getData();
  }, []);

  useEffect(() => {
  if (data.length > 0) {
    // Clear existing charts first to prevent duplicates
    d3.select('.unique-authors-chart-container').selectAll('*').remove();
    d3.select('.language-pie-chart-container').selectAll('*').remove();
    
    // Create decade-country distribution data
    const decadeCounts: Record<string, Record<string, number>> = {};

    data.forEach((entry: any) => {
      const year = parseInt(entry.journal_year);
      const decade = `${Math.floor(year / 10) * 10}s`;

      if (!decadeCounts[decade]) {
        decadeCounts[decade] = {};
      }

      if (!decadeCounts[decade][entry.country]) {
        decadeCounts[decade][entry.country] = 0;
      }

      decadeCounts[decade][entry.country]++;
    });

    const sortedDecades = Object.keys(decadeCounts).sort((a, b) => parseInt(a) - parseInt(b));

    sortedDecades.forEach((decade) => {
      const countries = Object.keys(decadeCounts[decade]);
      const totalCount = countries.reduce((acc, country) => acc + decadeCounts[decade][country], 0);

      countries.forEach((country) => {
        decadeCounts[decade][country] = (decadeCounts[decade][country] / totalCount) * 100;
      });
    });

    // Create author count data
    const authorCounts: Record<string, Set<string>> = {};

    data.forEach((entry: any) => {
      const year = parseInt(entry.journal_year);
      const decade = `${Math.floor(year / 10) * 10}s`;
      if (!authorCounts[decade]) {
        authorCounts[decade] = new Set();
      }
      authorCounts[decade].add(entry.author);
    });

    const uniqueAuthorsPerDecade = Object.keys(authorCounts).map(decade => ({
      decade,
      count: authorCounts[decade].size
    })).sort((a, b) => parseInt(a.decade) - parseInt(b.decade));

    // Create country contribution data for the map using country_latin field
    const countryCounts: Record<string, number> = {};

    data.forEach((entry: any) => {
      if (entry.country_latin) {
        // Check if entry.country_latin contains "USA"
        if (entry.country_latin.includes("USA")) {
          countryCounts["USA"] = (countryCounts["USA"] || 0) + 1;
        } 
        // Otherwise count the country as-is
        else {
          countryCounts[entry.country_latin] = (countryCounts[entry.country_latin] || 0) + 1;
        }
      }
    });

    // Create language distribution data
    const languageCounts: Record<string, number> = {};
    
    data.forEach((entry: any) => {
      if (entry.language_latin && entry.language_latin.trim() !== '') {
        languageCounts[entry.language_latin] = (languageCounts[entry.language_latin] || 0) + 1;
      }
    });

    // Create all visualizations
    createBarChart(decadeCounts);
    createUniqueAuthorsChart(uniqueAuthorsPerDecade);
    createLanguagePieChart(languageCounts); // This function call was missing
  }
}, [data, worldData]);

  function createBarChart(decadeCounts: Record<string, Record<string, number>>) {
    const svgWidth = 800;
    const svgHeight = 600;

    const svg = d3.select('.countries-chart-container')
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const chart = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create tooltip div
    const tooltipDiv = d3.select('.countries-chart-container')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'rgba(0, 0, 0, 0.7)')
      .style('color', 'white')
      .style('padding', '5px 10px')
      .style('border-radius', '5px')
      .style('pointer-events', 'none')
      .style('z-index', '100');

    const decades = Object.keys(decadeCounts);
    const countries = Array.from(new Set(Object.keys(decadeCounts).flatMap(decade => Object.keys(decadeCounts[decade]))));

    const sortedDecades = decades.sort((a, b) => parseInt(a) - parseInt(b));

    const xScale = d3.scaleBand()
      .domain(sortedDecades)
      .range([0, chartWidth])
      .paddingInner(0.1)
      .paddingOuter(0);

    const yScale = d3.scaleLinear()
      .domain([0, 100]) // Since we're dealing with percentages that sum to 100
      .range([chartHeight, 0]);

    const colorPalette = [
      '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', 
      '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
      '#1f77b4', '#ff7f0e', '#d62728', '#17becf', '#2ca02c', 
      '#bcbd22', '#9467bd', '#e377c2', '#8c564b', '#7f7f7f',
      '#aec7e8', '#ffbb78', '#ff9896', '#98df8a', '#c5b0d5', 
      '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
      '#3182bd', '#6baed6', '#9ecae1', '#c6dbef',
      '#e6550d', '#fd8d3c', '#fdae6b', '#fdd0a2',
      '#31a354', '#74c476', '#a1d99b', '#c7e9c0',
      '#756bb1', '#9e9ac8', '#bcbddc', '#dadaeb',
      '#636363', '#969696', '#bdbdbd', '#d9d9d9'
    ];

    const colorScale = d3.scaleOrdinal(colorPalette).domain(countries);

    sortedDecades.forEach((decade) => {
      const countriesData = Object.entries(decadeCounts[decade]);
      let yOffset = 0;

      countriesData.forEach(([country, percentage]) => {
        const bar = chart.append('rect')
          .attr('x', xScale(decade))
          .attr('y', yScale(yOffset + percentage))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale(yOffset) - yScale(yOffset + percentage))
          .attr('fill', colorScale(country))
          .on('mouseover', function (event) {
            // Highlight this bar
            d3.select(this).attr('fill', 'white');
            
            // Show tooltip with country and percentage
            tooltipDiv.transition()
              .duration(200)
              .style('opacity', 0.9);
            
            tooltipDiv.html(`<strong>${country}</strong><br/>Percentage: ${percentage.toFixed(2)}%`)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function () {
            // Restore original color
            d3.select(this).attr('fill', colorScale(country));
            
            // Hide tooltip
            tooltipDiv.transition()
              .duration(500)
              .style('opacity', 0);
          });

        yOffset += percentage;
      });
    });

    chart.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', 'white');

    chart.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => d + '%'))
      .selectAll('text')
      .style('fill', 'white');
  }

  function createUniqueAuthorsChart(data: { decade: string, count: number }[]) {
    const svgWidth = 800;
    const svgHeight = 400;

    const svg = d3.select('.unique-authors-chart-container')
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const chart = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create tooltip div
    const tooltipDiv = d3.select('.unique-authors-chart-container')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'rgba(0, 0, 0, 0.7)')
      .style('color', 'white')
      .style('padding', '5px 10px')
      .style('border-radius', '5px')
      .style('pointer-events', 'none')
      .style('z-index', '100');

    const xScale = d3.scaleBand()
      .domain(data.map(d => d.decade))
      .range([0, chartWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 0])
      .range([chartHeight, 0]);

    chart.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.decade) || 0)
      .attr('y', d => yScale(d.count))
      .attr('width', xScale.bandwidth())
      .attr('height', d => chartHeight - yScale(d.count))
      .attr('fill', '#3498db')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .attr('fill', 'white');

        tooltipDiv.transition()
          .duration(200)
          .style('opacity', 0.9);
        
        tooltipDiv.html(`<strong>${d.decade}</strong><br/>Unique Authors: ${d.count}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this)
          .attr('fill', '#3498db');

        tooltipDiv.transition()
          .duration(500)
          .style('opacity', 0);
      });

    chart.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', 'white');

    chart.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', 'white');
  }

    function createLanguagePieChart(languageCounts: Record<string, number>) {
    // Increased width from 600 to 900 for better label spacing
    const width = 900;
    const height = 500;
    const radius = Math.min(width, height) / 2.5;

    // Get top 10 languages
    const topLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([language, count]) => ({ language, count }));

    // Calculate total for percentage
    const total = topLanguages.reduce((acc, { count }) => acc + count, 0);

    // Create SVG
    const svg = d3.select('.language-pie-chart-container')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Create tooltip div
    const tooltipDiv = d3.select('.language-pie-chart-container')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'rgba(0, 0, 0, 0.7)')
      .style('color', 'white')
      .style('padding', '5px 10px')
      .style('border-radius', '5px')
      .style('pointer-events', 'none')
      .style('z-index', '100');

    // Color palette for the pie chart - use d3's color schemes
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Create pie layout
    const pie = d3.pie<any>()
      .value(d => d.count)
      .sort(null); // Don't sort, maintain the order we defined

    // Generate the pie chart data
    const pieData = pie(topLanguages);

    // Generate arc for each slice
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius * 0.8);

    // Generate outer arc for labels - increased distance
    const outerArc = d3.arc()
      .innerRadius(radius * 1.0)
      .outerRadius(radius * 1.0);

    // Add slices
    svg.selectAll('path')
      .data(pieData)
      .enter()
      .append('path')
      .attr('d', arc as any)
      .attr('fill', (d, i) => color(i.toString()))
      .attr('stroke', 'white')
      .style('stroke-width', '2px')
      .style('opacity', 0.8)
      .on('mouseover', function(event, d: any) {
        // Highlight the slice
        d3.select(this)
          .style('opacity', 1)
          .style('stroke', 'white')
          .style('stroke-width', '3px');

        // Calculate percentage
        const percentage = ((d.data.count / total) * 100).toFixed(1);

        // Show tooltip
        tooltipDiv.transition()
          .duration(200)
          .style('opacity', 0.9);

        tooltipDiv.html(`<strong>${d.data.language}</strong><br/>
                       Count: ${d.data.count}<br/>
                       Percentage: ${percentage}%`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        // Restore slice style
        d3.select(this)
          .style('opacity', 0.8)
          .style('stroke-width', '2px');

        // Hide tooltip
        tooltipDiv.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Add labels with increased distance for better visibility
    const labels = svg.selectAll('text')
      .data(pieData)
      .enter()
      .append('text')
      .attr('transform', function(d: any) {
        const pos = outerArc.centroid(d as any);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        pos[0] = radius * 1.1 * (midAngle < Math.PI ? 1 : -1);
        return `translate(${pos})`;
      })
      .attr('dy', '.35em')
      .style('text-anchor', function(d: any) {
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        return midAngle < Math.PI ? 'start' : 'end';
      })
      .style('fill', 'white')
      .text(function(d: any) {
        // Calculate percentage for label
        const percentage = ((d.data.count / total) * 100).toFixed(1);
        return `${d.data.language} (${percentage}%)`;
      });

    // Add polylines to connect slices to labels
    svg.selectAll('polyline')
      .data(pieData)
      .enter()
      .append('polyline')
      .attr('points', function(d: any) {
        const pos = outerArc.centroid(d as any);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        pos[0] = radius * 1.1 * (midAngle < Math.PI ? 1 : -1);
        return [arc.centroid(d as any), outerArc.centroid(d as any), pos];
      })
      .style('fill', 'none')
      .style('stroke', 'white')
      .style('stroke-width', '1px')
      .style('opacity', 0.8);

    // Add title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -height/2 + 20)
      .attr('x', 0)
      .text('Top 10 Languages')
      .style('font-size', '20px')
      .style('fill', 'white');
  }


  return (
    <div className={styles.container}>
      <Head>
        <title>Vsesvit</title>
        <meta name="description" content="Vsesvit project" />
      </Head>

      <nav className={styles.navbar}>
        <ul className={styles.navList}>
          <li className={styles.navItem}><Link href="/">Main</Link></li>
          <li className={styles.navItem}><Link href="/search">Search</Link></li>
          <li className={styles.navItem}><Link href="/visualizations">Visualizations</Link></li>
          <li className={styles.navItem}><Link href="/ai_chat">AI chat</Link></li>
          <li className={styles.navItem}><Link href="/about">About</Link></li>
        </ul>
      </nav>


      <main className={styles.main} style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '3rem', // Consistent spacing between all elements
        backgroundColor: '#303841', // Slightly lighter than default dark background
        padding: '2rem',
        borderRadius: '8px'
      }}>

        <div style={{ 
          width: '70%', 
          backgroundColor: '#3A444E', 
          padding: '1.5rem', 
          borderRadius: '8px' 
        }}>
          <h2 style={{ color: 'white', marginTop: 0 }}>1. Unique Authors Per Decade</h2>
          <p style={{ fontFamily: 'verdana', fontSize: '1rem', lineHeight: '1.5', margin: 0 }}>
            This chart shows the number of unique authors published in each decade. The bars represent the total count of distinct authors whose works appeared during that time period. Hover over each bar to see the exact count.
          </p>
          <div className="unique-authors-chart-container" style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'center',
          }}></div>
        </div>

        <div style={{ 
          width: '70%', 
          backgroundColor: '#3A444E', 
          padding: '1.5rem', 
          borderRadius: '8px' 
        }}>
          <h2 style={{ color: 'white', marginTop: 0 }}>4. Top 10 Languages Distribution</h2>
          <p style={{ fontFamily: 'verdana', fontSize: '1rem', lineHeight: '1.5', margin: 0 }}>
            This pie chart displays the distribution of the top 10 most frequently occurring languages in the dataset, based on the language_latin field. Each slice represents a language, with its size proportional to the number of texts in that language. Hover over any slice to see detailed information including the exact count and percentage of the total.
          </p>
          <div className="language-pie-chart-container" style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'center'
          }}></div>
        </div>

       
      
      </main>


      <style jsx>{`
        .tooltip {
          position: absolute;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border-radius: 5px;
          padding: 5px 10px;
          pointer-events: none;
          z-index: 100;
        }
      `}</style>
    </div>
  );
}

export default Visualizations;
