using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using Microsoft.Extensions.Caching.Memory;

[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;

    public UserController(IConfiguration configuration, IMemoryCache cache)
    {
        _configuration = configuration;
        _cache = cache;
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetUserDetails(int userId)
    {
        string cacheKey = $"UserDetails_{userId}";

        if (_cache.TryGetValue(cacheKey, out object cachedUser))
        {
            return Ok(cachedUser);
        }
        try
        {
            using (var connection = new SqlConnection(_configuration.GetConnectionString("DefaultConnection")))
            {
                await connection.OpenAsync();

                using (SqlCommand command = new SqlCommand("sp_GetUserDetails", connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.Parameters.AddWithValue("@UserId", userId);

                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            var userDetails = new
                            {
                                Id = reader["Id"],
                                Username = reader["Username"],
                                OnlineStatus = reader["OnlineStatus"]
                            };

                            _cache.Set(cacheKey, userDetails, TimeSpan.FromMinutes(10));
                            return Ok(userDetails);
                        }
                        else
                        {
                            return NotFound("User not found.");
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error retrieving user details: {ex.Message}");
            return StatusCode(500, "An internal server error occurred.");
        }
    }
}
