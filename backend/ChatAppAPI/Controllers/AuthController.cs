using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public AuthController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(UserDto userDto)
    {
        try
        {
            using (var connection = new SqlConnection(_configuration.GetConnectionString("DefaultConnection")))
            {
                await connection.OpenAsync();

                var cmd = new SqlCommand("sp_RegisterUser", connection)
                {
                    CommandType = CommandType.StoredProcedure
                };
                cmd.Parameters.AddWithValue("@Username", userDto.Username);
                cmd.Parameters.AddWithValue("@PasswordHash", BCrypt.Net.BCrypt.HashPassword(userDto.Password));
                cmd.Parameters.AddWithValue("@OnlineStatus", false);

                try
                {
                    await cmd.ExecuteNonQueryAsync();
                    return Ok("User registered successfully");
                }
                catch (SqlException ex)
                {
                    if (ex.Message.Contains("Username already exists"))
                    {
                        return BadRequest("Username already exists.");
                    }
                    else if (ex.Message.Contains("Password must be at least"))
                    {
                        return BadRequest(ex.Message);
                    }
                    else if (ex.Message.Contains("Username must be at least"))
                    {
                        return BadRequest(ex.Message);
                    }
                    else
                    {
                        return StatusCode(500, "An error occurred during registration.");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, "An error occurred during registration.");
        }
    }

    // Login User
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] UserDto userDto)
    {
        try
        {
            if (userDto == null || string.IsNullOrWhiteSpace(userDto.Username) || string.IsNullOrWhiteSpace(userDto.Password))
            {
                return BadRequest("Username and password are required.");
            }

            using (var connection = new SqlConnection(_configuration.GetConnectionString("DefaultConnection")))
            {
                await connection.OpenAsync();

                 var cmd = new SqlCommand("sp_LoginUser", connection)
                {
                    CommandType = CommandType.StoredProcedure
                };
                cmd.Parameters.AddWithValue("@Username", userDto.Username);

                var userIdParam = new SqlParameter("@UserId", SqlDbType.Int) { Direction = ParameterDirection.Output };
                var passwordHashParam = new SqlParameter("@PasswordHash", SqlDbType.NVarChar, 255) { Direction = ParameterDirection.Output };
                var onlineStatusParam = new SqlParameter("@OnlineStatus", SqlDbType.Bit) { Direction = ParameterDirection.Output };

                cmd.Parameters.Add(userIdParam);
                cmd.Parameters.Add(passwordHashParam);
                cmd.Parameters.Add(onlineStatusParam);

                try
                {
                    await cmd.ExecuteNonQueryAsync();

                    var userId = (int)userIdParam.Value;
                    var passwordHash = (string)passwordHashParam.Value;
                    var onlineStatus = (bool)onlineStatusParam.Value;

                    if (userId == 0)
                    {
                        return Unauthorized("Invalid username or password.");
                    }

                    // Verify the password
                    if (!BCrypt.Net.BCrypt.Verify(userDto.Password, passwordHash))
                    {
                        return Unauthorized("Invalid username or password.");
                    }

                    // Generate JWT token
                    var token = GenerateJwtToken(userId, userDto.Username);

                    return Ok(new
                    {
                        Token = token,
                        UserId = userId,
                        UserName = userDto.Username,
                        OnlineStatus = onlineStatus 
                    });
                }
                catch (SqlException ex)
                {
                    if (ex.Message.Contains("Password must be at least"))
                    {
                        return BadRequest(ex.Message);
                    }
                    else
                    {
                        return StatusCode(500, ex.Message);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Login Error: {ex.Message}");
            return StatusCode(500, "An internal server error occurred.");
        }
    }


    [HttpPost]
    public string GenerateJwtToken(int userId, string username)
    {
        try
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, username)
        };

            var token = new JwtSecurityToken(
                issuer: "chatAPI",
                audience: "chatAPI",
                claims: claims,
                expires: DateTime.UtcNow.AddDays(1),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"JWT Generation Error: {ex.Message}");
            throw;
        }
    }

}

